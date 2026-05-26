import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/api-auth'
import { aiService } from '@/lib/ai-service'

// ============================================================
// AI System Prompt for vault structure generation
// ============================================================

const VAULT_GENERATION_SYSTEM_PROMPT = `You are an expert knowledge management architect who designs Obsidian-style vault structures for software projects. You analyze project requirements and generate a well-organized vault structure with folders and markdown notes.

Your output MUST be valid JSON with this exact schema:
{
  "nodes": [
    {
      "name": "FolderName or NoteName.md",
      "type": "FOLDER" or "NOTE",
      "parentId": null or index of parent node (0-based),
      "sortOrder": 0,
      "icon": "emoji or null",
      "color": "hex color or null",
      "frontmatter": { "key": "value" } or null,
      "content": "Markdown content with [[wiki-links]]" or null (null for folders),
      "tags": ["tag1", "tag2"] or null
    }
  ]
}

Rules:
1. Folders should use type "FOLDER", notes should use type "NOTE"
2. Note names should end with ".md"
3. Use parentId as the 0-based index of the parent node in the array, or null for root
4. Create a comprehensive vault structure following this pattern:
   - 00-Inbox/ (for unprocessed ideas)
   - 01-Requirements/ (functional & non-functional requirements)
   - 02-Architecture/ (system design, data models, API design)
   - 03-Implementation/ (sprint plans, technical decisions, coding standards)
   - 04-Testing/ (test strategy, test cases)
   - 05-Deployment/ (deployment plan, environment config)
   - README.md (project index with links to all sections)
5. Each note must have:
   - YAML frontmatter with: title, created (today's date), tags, status
   - Meaningful markdown content with [[wiki-links]] to related notes
   - At least 3-5 wiki-links per note to create a rich knowledge graph
6. Use Obsidian-style wiki-links like [[Functional Requirements]] to reference other notes
7. Generate content that is specific to the requirements provided, not generic
8. The README.md should be an index that links to all major sections
9. Sort folders with numeric prefixes (00-, 01-, etc.) for proper ordering
10. Each note should have 2-4 relevant tags

Return ONLY the JSON object, no markdown code fences, no explanation.`

// ============================================================
// POST /api/projects/[id]/vault/generate - AI-generate vault structure
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUser(request)
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await params
    const body = await request.json()
    const { requirements } = body

    if (!requirements || typeof requirements !== 'string' || requirements.trim().length === 0) {
      return NextResponse.json(
        { error: 'requirements is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const project = await db.project.findUnique({ where: { id: projectId } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Call AI to generate vault structure
    const userPrompt = `Analyze the following project requirements and generate a comprehensive Obsidian-style vault structure with folders, markdown notes, YAML frontmatter, and wiki-links.

Project Name: ${project.name}
${project.description ? `Project Description: ${project.description}` : ''}

Requirements:
${requirements}`

    const result = await aiService.generateText({
      systemPrompt: VAULT_GENERATION_SYSTEM_PROMPT,
      userPrompt,
    })

    // Parse the AI response
    let vaultStructure: {
      nodes: Array<{
        name: string
        type: string
        parentId: number | null
        sortOrder: number
        icon: string | null
        color: string | null
        frontmatter: Record<string, unknown> | null
        content: string | null
        tags: string[] | null
      }>
    }

    try {
      // Try to extract JSON from the response (handle potential markdown code fences)
      let jsonStr = result.output.trim()
      // Remove markdown code fences if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      vaultStructure = JSON.parse(jsonStr)
    } catch {
      console.error('Failed to parse AI vault generation output:', result.output.substring(0, 500))
      return NextResponse.json(
        { error: 'AI generated invalid vault structure. Please try again.' },
        { status: 422 }
      )
    }

    if (!vaultStructure.nodes || !Array.isArray(vaultStructure.nodes)) {
      return NextResponse.json(
        { error: 'AI generated invalid vault structure: missing nodes array' },
        { status: 422 }
      )
    }

    // Create all vault nodes in the database
    // We need to create them in order and track the mapping from array index to DB id
    const indexToIdMap = new Map<number, string>()
    const createdNodes: Array<{
      id: string
      projectId: string
      parentId: string | null
      name: string
      type: string
      content: string | null
      frontmatter: string | null
      tags: string | null
      sortOrder: number
      isPinned: boolean
      isExpanded: boolean
      icon: string | null
      color: string | null
      createdById: string | null
      createdAt: Date
      updatedAt: Date
    }> = []

    for (let i = 0; i < vaultStructure.nodes.length; i++) {
      const nodeDef = vaultStructure.nodes[i]

      // Resolve parentId from index to actual DB id
      let parentDbId: string | null = null
      if (nodeDef.parentId !== null && nodeDef.parentId !== undefined) {
        parentDbId = indexToIdMap.get(nodeDef.parentId) ?? null
      }

      // Serialize frontmatter and tags as JSON strings
      const frontmatterStr = nodeDef.frontmatter
        ? JSON.stringify(nodeDef.frontmatter)
        : null
      const tagsStr = nodeDef.tags
        ? JSON.stringify(nodeDef.tags)
        : null

      const created = await db.vaultNode.create({
        data: {
          projectId,
          name: nodeDef.name,
          type: nodeDef.type || 'NOTE',
          parentId: parentDbId,
          content: nodeDef.content ?? null,
          frontmatter: frontmatterStr,
          tags: tagsStr,
          sortOrder: nodeDef.sortOrder ?? i,
          icon: nodeDef.icon ?? null,
          color: nodeDef.color ?? null,
          createdById: authUser.id,
        },
      })

      indexToIdMap.set(i, created.id)
      createdNodes.push(created)
    }

    // Create wiki-links between nodes based on [[...]] patterns in content
    const createdLinks: Array<{
      id: string
      sourceId: string
      targetId: string
      label: string | null
      linkType: string
      createdAt: Date
    }> = []

    // Build name-to-id map for wiki-link resolution
    const nameToIdMap = new Map<string, string>()
    for (let i = 0; i < vaultStructure.nodes.length; i++) {
      const nodeDef = vaultStructure.nodes[i]
      const dbId = indexToIdMap.get(i)
      if (dbId) {
        // Map both the full name and the name without .md extension
        nameToIdMap.set(nodeDef.name, dbId)
        if (nodeDef.name.endsWith('.md')) {
          nameToIdMap.set(nodeDef.name.replace(/\.md$/, ''), dbId)
        }
      }
    }

    // Extract wiki-links from each note's content and create VaultLink entries
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g
    for (let i = 0; i < vaultStructure.nodes.length; i++) {
      const nodeDef = vaultStructure.nodes[i]
      const sourceId = indexToIdMap.get(i)
      if (!sourceId || !nodeDef.content) continue

      const links = new Set<string>()
      let match: RegExpExecArray | null
      const regex = new RegExp(wikiLinkRegex.source, wikiLinkRegex.flags)
      while ((match = regex.exec(nodeDef.content)) !== null) {
        links.add(match[1].trim())
      }

      for (const linkName of links) {
        const targetId = nameToIdMap.get(linkName)
        if (!targetId || targetId === sourceId) continue

        try {
          const link = await db.vaultLink.create({
            data: {
              sourceId,
              targetId,
              linkType: 'REFERENCE',
            },
          })
          createdLinks.push(link)
        } catch {
          // Unique constraint violation - skip duplicate links
        }
      }
    }

    return NextResponse.json({
      data: {
        nodes: createdNodes,
        links: createdLinks,
        generationMeta: {
          latencyMs: result.latencyMs,
          tokenUsage: result.tokenUsage,
          nodeCount: createdNodes.length,
          linkCount: createdLinks.length,
        },
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Generate vault structure error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
