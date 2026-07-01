import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// ============================================================
// Enterprise AI Workflow Platform - Database Seed
// ============================================================

async function seed() {
  console.log('🌱 Seeding database...\n')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'

  // ──────────────────────────────────────────────────────────
  // 1. Create Departments
  // ──────────────────────────────────────────────────────────
  console.log('📦 Creating departments...')
  const itDept = await db.department.upsert({
    where: { code: 'IT' },
    update: {},
    create: { name: 'Information Technology', code: 'IT' },
  })
  const baDept = await db.department.upsert({
    where: { code: 'BA' },
    update: {},
    create: { name: 'Business Analysis', code: 'BA' },
  })
  const qaDept = await db.department.upsert({
    where: { code: 'QA' },
    update: {},
    create: { name: 'Quality Assurance', code: 'QA' },
  })
  const pmDept = await db.department.upsert({
    where: { code: 'PM' },
    update: {},
    create: { name: 'Project Management', code: 'PM' },
  })

  // ──────────────────────────────────────────────────────────
  // 2. Create Permissions
  // ──────────────────────────────────────────────────────────
  console.log('🔐 Creating permissions...')

  const permissionDefs = [
    // Project module
    { key: 'project:read', name: 'Read Projects', module: 'project' },
    { key: 'project:write', name: 'Create/Edit Projects', module: 'project' },
    { key: 'project:delete', name: 'Delete Projects', module: 'project' },
    { key: 'project:manage_members', name: 'Manage Project Members', module: 'project' },
    { key: 'project:manage_settings', name: 'Manage Project Settings', module: 'project' },

    // Request module
    { key: 'request:read', name: 'Read Requests', module: 'request' },
    { key: 'request:write', name: 'Create/Edit Requests', module: 'request' },
    { key: 'request:delete', name: 'Delete Requests', module: 'request' },
    { key: 'request:approve', name: 'Approve Requests', module: 'request' },
    { key: 'request:assign', name: 'Assign Requests', module: 'request' },
    { key: 'request:classify', name: 'Classify Requests', module: 'request' },

    // Workflow module
    { key: 'workflow:read', name: 'Read Workflows', module: 'workflow' },
    { key: 'workflow:write', name: 'Create/Edit Workflows', module: 'workflow' },
    { key: 'workflow:manage', name: 'Manage Workflow Definitions', module: 'workflow' },
    { key: 'workflow:transition', name: 'Transition Workflow Steps', module: 'workflow' },

    // Work item / MIT module
    { key: 'workitem:read', name: 'Read Work Items', module: 'workitem' },
    { key: 'workitem:write', name: 'Create/Edit Work Items', module: 'workitem' },
    { key: 'workitem:assign', name: 'Assign Work Items', module: 'workitem' },
    { key: 'workitem:handoff', name: 'Handoff Work Items', module: 'workitem' },
    { key: 'mit:assign', name: 'Assign MIT Items', module: 'workitem' },
    { key: 'mit:accept', name: 'Accept MIT Items', module: 'workitem' },

    // Meeting module
    { key: 'meeting:read', name: 'Read Meetings', module: 'meeting' },
    { key: 'meeting:write', name: 'Create/Edit Meetings', module: 'meeting' },
    { key: 'meeting:manage_bot', name: 'Manage Meeting Bot', module: 'meeting' },
    { key: 'meeting:transcript', name: 'View Transcripts', module: 'meeting' },
    { key: 'meeting:summary', name: 'View Summaries', module: 'meeting' },

    // UAT module
    { key: 'uat:read', name: 'Read UAT Cycles', module: 'uat' },
    { key: 'uat:write', name: 'Create/Edit UAT Cycles', module: 'uat' },
    { key: 'uat:execute', name: 'Execute UAT Tests', module: 'uat' },
    { key: 'uat:manage', name: 'Manage UAT Cycles', module: 'uat' },

    // Bug module
    { key: 'bug:read', name: 'Read Bug Reports', module: 'bug' },
    { key: 'bug:write', name: 'Create/Edit Bug Reports', module: 'bug' },
    { key: 'bug:rca', name: 'Root Cause Analysis', module: 'bug' },

    // Change module
    { key: 'change:read', name: 'Read Change Requests', module: 'change' },
    { key: 'change:write', name: 'Create/Edit Change Requests', module: 'change' },
    { key: 'change:approve', name: 'Approve Change Requests', module: 'change' },

    // AI Prompt module
    { key: 'prompt:read', name: 'Read AI Prompts', module: 'prompt' },
    { key: 'prompt:write', name: 'Create/Edit AI Prompts', module: 'prompt' },
    { key: 'prompt:activate', name: 'Activate AI Prompts', module: 'prompt' },
    { key: 'prompt:test', name: 'Test AI Prompts', module: 'prompt' },

    // Maintenance module
    { key: 'maintenance:read', name: 'Read Maintenance Agreements', module: 'maintenance' },
    { key: 'maintenance:write', name: 'Create/Edit Maintenance Agreements', module: 'maintenance' },

    // Dashboard / Reports
    { key: 'dashboard:view', name: 'View Dashboard', module: 'dashboard' },
    { key: 'dashboard:analytics', name: 'View Analytics', module: 'dashboard' },
    { key: 'report:export', name: 'Export Reports', module: 'dashboard' },

    // User management
    { key: 'user:read', name: 'Read Users', module: 'user' },
    { key: 'user:write', name: 'Create/Edit Users', module: 'user' },
    { key: 'user:manage_roles', name: 'Manage User Roles', module: 'user' },

    // Admin module
    { key: 'admin:access', name: 'Access Admin Console', module: 'admin' },
    { key: 'admin:settings', name: 'Manage System Settings', module: 'admin' },
    { key: 'admin:audit', name: 'View Audit Logs', module: 'admin' },
    { key: 'admin:integrations', name: 'Manage Integrations', module: 'admin' },
    { key: 'admin:jobs', name: 'Manage Background Jobs', module: 'admin' },
    { key: 'admin:document_number', name: 'Manage Document Numbers', module: 'admin' },

    // Approval module
    { key: 'approval:read', name: 'Read Approval Workflows', module: 'approval' },
    { key: 'approval:write', name: 'Create/Edit Approval Workflows', module: 'approval' },
    { key: 'approval:action', name: 'Approve/Reject', module: 'approval' },

    // GitHub module
    { key: 'github:read', name: 'View GitHub Data', module: 'github' },
    { key: 'github:sync', name: 'Sync GitHub Data', module: 'github' },
    { key: 'github:manage', name: 'Manage GitHub Connections', module: 'github' },
  ]

  const permissionMap: Record<string, string> = {}
  for (const pDef of permissionDefs) {
    const p = await db.permission.upsert({
      where: { key: pDef.key },
      update: { name: pDef.name, module: pDef.module },
      create: pDef,
    })
    permissionMap[pDef.key] = p.id
  }

  // ──────────────────────────────────────────────────────────
  // 3. Create Roles
  // ──────────────────────────────────────────────────────────
  console.log('👥 Creating roles...')

  const roleDefs: Record<string, { name: string; description: string; permissions: string[] }> = {
    ADMIN: {
      name: 'Administrator',
      description: 'Full system access with all permissions',
      permissions: Object.keys(permissionMap),
    },
    IT_MANAGER: {
      name: 'IT Manager',
      description: 'Manages IT projects, resources, and team assignments',
      permissions: [
        'project:read', 'project:write', 'project:manage_members', 'project:manage_settings',
        'request:read', 'request:write', 'request:approve', 'request:assign',
        'workflow:read', 'workflow:transition',
        'workitem:read', 'workitem:write', 'workitem:assign', 'workitem:handoff',
        'mit:assign', 'mit:accept',
        'meeting:read', 'meeting:write',
        'uat:read', 'uat:manage',
        'bug:read', 'bug:write', 'bug:rca',
        'change:read', 'change:write', 'change:approve',
        'prompt:read', 'prompt:test',
        'maintenance:read', 'maintenance:write',
        'dashboard:view', 'dashboard:analytics', 'report:export',
        'user:read',
        'admin:access', 'admin:audit', 'admin:integrations',
        'approval:read', 'approval:action',
        'github:read', 'github:sync',
      ],
    },
    PROJECT_MANAGER: {
      name: 'Project Manager',
      description: 'Manages projects, requests, and team coordination',
      permissions: [
        'project:read', 'project:write', 'project:manage_members', 'project:manage_settings',
        'request:read', 'request:write', 'request:approve', 'request:assign',
        'workflow:read', 'workflow:transition',
        'workitem:read', 'workitem:write', 'workitem:assign', 'workitem:handoff',
        'mit:assign',
        'meeting:read', 'meeting:write',
        'uat:read', 'uat:manage',
        'bug:read', 'bug:write',
        'change:read', 'change:write',
        'prompt:read',
        'maintenance:read',
        'dashboard:view', 'dashboard:analytics', 'report:export',
        'user:read',
        'admin:access',
        'approval:read', 'approval:action',
        'github:read',
      ],
    },
    APPROVER: {
      name: 'Approver',
      description: 'Reviews and approves requests and changes',
      permissions: [
        'project:read',
        'request:read', 'request:approve',
        'workflow:read', 'workflow:transition',
        'workitem:read',
        'change:read', 'change:approve',
        'dashboard:view',
        'approval:read', 'approval:action',
      ],
    },
    BA: {
      name: 'Business Analyst',
      description: 'Analyzes requirements, creates specifications, and classifies requests',
      permissions: [
        'project:read',
        'request:read', 'request:write', 'request:classify', 'request:assign',
        'workflow:read', 'workflow:transition',
        'workitem:read', 'workitem:write',
        'mit:assign', 'mit:accept',
        'meeting:read', 'meeting:write', 'meeting:transcript', 'meeting:summary',
        'uat:read', 'uat:write',
        'bug:read',
        'change:read', 'change:write',
        'prompt:read', 'prompt:test',
        'dashboard:view',
      ],
    },
    DEVELOPER: {
      name: 'Developer',
      description: 'Develops and implements features and fixes',
      permissions: [
        'project:read',
        'request:read',
        'workflow:read', 'workflow:transition',
        'workitem:read', 'workitem:write',
        'mit:accept',
        'bug:read', 'bug:write', 'bug:rca',
        'change:read',
        'prompt:read',
        'dashboard:view',
        'github:read',
      ],
    },
    QA: {
      name: 'Quality Assurance',
      description: 'Tests features, manages UAT cycles, and reports bugs',
      permissions: [
        'project:read',
        'request:read',
        'workflow:read', 'workflow:transition',
        'workitem:read',
        'mit:accept',
        'meeting:read',
        'uat:read', 'uat:write', 'uat:execute', 'uat:manage',
        'bug:read', 'bug:write', 'bug:rca',
        'change:read',
        'prompt:read', 'prompt:test',
        'dashboard:view',
      ],
    },
    FULLSTACK: {
      name: 'Full Stack Developer',
      description: 'Can work on any technical step (BA, DEV, QA, UAT, MA)',
      permissions: [
        'project:read',
        'request:read',
        'workflow:read', 'workflow:transition',
        'workitem:read', 'workitem:write',
        'mit:assign', 'mit:accept',
        'meeting:read',
        'uat:read', 'uat:write', 'uat:execute',
        'bug:read', 'bug:write', 'bug:rca',
        'change:read',
        'prompt:read',
        'dashboard:view',
        'github:read',
      ],
    },
    REQUESTER: {
      name: 'Requester',
      description: 'Creates and tracks requests',
      permissions: [
        'project:read',
        'request:read', 'request:write',
        'workitem:read',
        'meeting:read',
        'dashboard:view',
      ],
    },
    VIEWER: {
      name: 'Viewer',
      description: 'Read-only access to dashboards and reports',
      permissions: [
        'project:read',
        'request:read',
        'dashboard:view',
      ],
    },
  }

  const roleMap: Record<string, string> = {}
  for (const [key, rDef] of Object.entries(roleDefs)) {
    const role = await db.role.upsert({
      where: { key },
      update: { name: rDef.name, description: rDef.description },
      create: { key, name: rDef.name, description: rDef.description },
    })
    roleMap[key] = role.id

    // Assign permissions to role
    for (const permKey of rDef.permissions) {
      const permId = permissionMap[permKey]
      if (permId) {
        await db.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId: permId },
          },
          update: {},
          create: { roleId: role.id, permissionId: permId },
        })
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // 4. Create Default Admin User
  // ──────────────────────────────────────────────────────────
  console.log('👤 Creating admin user...')
  const adminPassword = await hashPassword('admin123')
  const adminUser = await db.user.upsert({
    where: { email: 'admin@enterprise.com' },
    update: {},
    create: {
      email: 'admin@enterprise.com',
      password: adminPassword,
      name: 'Admin User',
      departmentId: itDept.id,
      isActive: true,
    },
  })

  // Assign ADMIN role
  await db.userRole.upsert({
    where: {
      userId_roleId: { userId: adminUser.id, roleId: roleMap['ADMIN'] },
    },
    update: {},
    create: { userId: adminUser.id, roleId: roleMap['ADMIN'] },
  })

  // ──────────────────────────────────────────────────────────
  // 5. Create Sample Users for Each Role
  // ──────────────────────────────────────────────────────────
  console.log('👥 Creating sample users...')

  const sampleUsers = [
    { email: 'itmanager@enterprise.com', name: 'IT Manager User', roleKey: 'IT_MANAGER', deptId: itDept.id },
    { email: 'pm@enterprise.com', name: 'Project Manager User', roleKey: 'PROJECT_MANAGER', deptId: pmDept.id },
    { email: 'approver@enterprise.com', name: 'Approver User', roleKey: 'APPROVER', deptId: pmDept.id },
    { email: 'ba@enterprise.com', name: 'BA User', roleKey: 'BA', deptId: baDept.id },
    { email: 'developer@enterprise.com', name: 'Developer User', roleKey: 'DEVELOPER', deptId: itDept.id },
    { email: 'piakdev@enterprise.com', name: 'Piakdev', roleKey: 'DEVELOPER', deptId: itDept.id },
    { email: 'dev2@enterprise.com', name: 'Developer Two', roleKey: 'DEVELOPER', deptId: itDept.id },
    { email: 'fullstack@enterprise.com', name: 'Fullstack User', roleKey: 'FULLSTACK', deptId: itDept.id },
    { email: 'qa@enterprise.com', name: 'QA User', roleKey: 'QA', deptId: qaDept.id },
    { email: 'qa2@enterprise.com', name: 'QA Two', roleKey: 'QA', deptId: qaDept.id },
    { email: 'requester@enterprise.com', name: 'Requester User', roleKey: 'REQUESTER', deptId: baDept.id },
    { email: 'viewer@enterprise.com', name: 'Viewer User', roleKey: 'VIEWER', deptId: itDept.id },
  ]

  const userMap: Record<string, string> = { admin: adminUser.id }
  for (const su of sampleUsers) {
    const pw = await hashPassword('password123')
    const user = await db.user.upsert({
      where: { email: su.email },
      update: {},
      create: {
        email: su.email,
        password: pw,
        name: su.name,
        departmentId: su.deptId,
        isActive: true,
      },
    })
    userMap[su.roleKey.toLowerCase()] = user.id

    await db.userRole.upsert({
      where: {
        userId_roleId: { userId: user.id, roleId: roleMap[su.roleKey] },
      },
      update: {},
      create: { userId: user.id, roleId: roleMap[su.roleKey] },
    })
  }

  // ──────────────────────────────────────────────────────────
  // 6. Create AI Prompt Entries
  // ──────────────────────────────────────────────────────────
  console.log('🤖 Creating AI prompt entries...')

  const promptDefs = [
    {
      promptKey: 'meeting.transcription.default',
      title: 'Meeting Transcription (Default)',
      description: 'Default prompt for processing and formatting meeting transcriptions',
      category: 'MEETING',
      versions: [{
        systemPrompt: 'You are a professional meeting transcription assistant. Your task is to process raw audio-to-text output and produce a clean, well-formatted transcript. Identify speakers when possible, remove filler words, and ensure readability while preserving the original meaning.',
        userPromptTemplate: 'Please process the following raw meeting transcript and produce a clean, formatted version:\n\n{{transcription}}',
      }],
    },
    {
      promptKey: 'meeting.summary.ba_requirement',
      title: 'Meeting Summary - BA Requirements',
      description: 'Extract business requirements from meeting summaries',
      category: 'MEETING',
      versions: [{
        systemPrompt: 'You are a senior Business Analyst AI assistant. Your task is to analyze meeting summaries and extract clear, structured business requirements. Identify functional requirements, non-functional requirements, constraints, and assumptions. Format each requirement with a unique ID, description, priority, and any relevant acceptance criteria.',
        userPromptTemplate: 'Analyze the following meeting summary and extract structured business requirements:\n\nMeeting Title: {{meetingTitle}}\nDate: {{meetingDate}}\nParticipants: {{participants}}\n\nSummary:\n{{summary}}',
      }],
    },
    {
      promptKey: 'meeting.action_items.extract',
      title: 'Meeting Action Items Extraction',
      description: 'Extract action items from meeting content',
      category: 'MEETING',
      versions: [{
        systemPrompt: 'You are a meeting action items extraction specialist. Analyze meeting content and identify all action items, decisions, and follow-ups. For each action item, identify: the task description, the assignee (if mentioned), the deadline (if mentioned), and the priority level. Also identify any decisions made and open questions that need resolution.',
        userPromptTemplate: 'Extract action items, decisions, and open questions from the following meeting:\n\nMeeting Title: {{meetingTitle}}\nDate: {{meetingDate}}\n\nTranscript/Summary:\n{{content}}',
      }],
    },
    {
      promptKey: 'request.intake.classify',
      title: 'Request Intake Classification',
      description: 'Classify and categorize incoming requests',
      category: 'INTAKE',
      versions: [{
        systemPrompt: 'You are an IT request classification AI. Analyze incoming requests and classify them by type (FEATURE, BUG, CHANGE, SUPPORT, QUESTION, INCIDENT), priority (LOW, MEDIUM, HIGH, URGENT), and affected system. Also identify the likely department and skills needed. Provide confidence scores for each classification.',
        userPromptTemplate: 'Classify the following IT request:\n\nTitle: {{title}}\nDescription: {{description}}\nSubmitted by: {{submitter}}\n\nProvide: type, priority, affected system, required skills, and confidence scores.',
      }],
    },
    {
      promptKey: 'request.intake.generate_draft',
      title: 'Request Intake Draft Generation',
      description: 'Generate a well-structured request draft from user input',
      category: 'INTAKE',
      versions: [{
        systemPrompt: 'You are an IT request drafting assistant. Transform rough user input into a well-structured, professional IT request. Generate a clear title, detailed description, suggested priority, affected system, business impact statement, and preliminary acceptance criteria. Also list any missing information that should be provided.',
        userPromptTemplate: 'Transform the following rough request into a well-structured IT request draft:\n\nUser Input: {{userInput}}\nContext: {{context}}',
      }],
    },
    {
      promptKey: 'workflow.next_action',
      title: 'Workflow Next Action Recommendation',
      description: 'Recommend the next action in a workflow based on current state',
      category: 'WORKFLOW',
      versions: [{
        systemPrompt: 'You are a workflow optimization AI. Given the current state of a request/work item and its history, recommend the next best action. Consider the current status, assigned roles, SLA requirements, and typical workflow patterns. Provide a clear recommendation with reasoning.',
        userPromptTemplate: 'Recommend the next action for this workflow:\n\nCurrent Status: {{currentStatus}}\nEntity Type: {{entityType}}\nHistory: {{history}}\nAssigned Roles: {{assignedRoles}}\nSLA: {{slaInfo}}',
      }],
    },
    {
      promptKey: 'handoff.generate_note',
      title: 'Handoff Note Generation',
      description: 'Generate structured handoff notes between team members',
      category: 'HANDOFF',
      versions: [{
        systemPrompt: 'You are a team handoff specialist. Generate clear, structured handoff notes when work is being transferred between team members or roles. Include: current progress summary, completed items, pending items, blockers, key decisions, and recommendations for the receiving person.',
        userPromptTemplate: 'Generate a handoff note:\n\nFrom: {{fromRole}} ({{fromName}})\nTo: {{toRole}} ({{toName}})\nWork Item: {{workItemTitle}}\nCurrent Status: {{currentStatus}}\nWork Done: {{workDone}}\nPending Items: {{pendingItems}}\nBlockers: {{blockers}}',
      }],
    },
    {
      promptKey: 'uat.generate_test_cases',
      title: 'UAT Test Case Generation',
      description: 'Generate UAT test cases from requirements',
      category: 'UAT',
      versions: [{
        systemPrompt: 'You are a QA test case design specialist. Given requirements or feature descriptions, generate comprehensive UAT test cases. For each test case, include: title, precondition, step-by-step instructions, expected result, priority, and type (FUNCTIONAL, REGRESSION, NEGATIVE, EDGE_CASE). Ensure good coverage across all scenarios.',
        userPromptTemplate: 'Generate UAT test cases for the following requirement:\n\nTitle: {{requirementTitle}}\nDescription: {{requirementDescription}}\nAcceptance Criteria: {{acceptanceCriteria}}\nType: {{requestType}}',
      }],
    },
    {
      promptKey: 'bug.root_cause_analysis',
      title: 'Bug Root Cause Analysis',
      description: 'Analyze bug reports and suggest root causes',
      category: 'BUG',
      versions: [{
        systemPrompt: 'You are a root cause analysis specialist for software bugs. Given a bug report, analyze the symptoms and provide: likely root cause categories, specific hypotheses, recommended investigation steps, and suggested fixes. Consider common patterns like data issues, logic errors, integration failures, and environment differences.',
        userPromptTemplate: 'Perform root cause analysis for this bug:\n\nTitle: {{bugTitle}}\nDescription: {{bugDescription}}\nSeverity: {{severity}}\nActual Result: {{actualResult}}\nExpected Result: {{expectedResult}}\nReproduction Steps: {{reproductionSteps}}',
      }],
    },
    {
      promptKey: 'dashboard.workload_insight',
      title: 'Dashboard Workload Insight',
      description: 'Generate workload insights and recommendations',
      category: 'DASHBOARD',
      versions: [{
        systemPrompt: 'You are a project workload analysis AI. Analyze team workload data and provide actionable insights. Identify bottlenecks, overloaded team members, underutilized resources, and potential risks. Suggest rebalancing actions and highlight items that may miss deadlines.',
        userPromptTemplate: 'Analyze the following workload data and provide insights:\n\nTeam Members: {{teamMembers}}\nActive Work Items: {{activeWorkItems}}\nPending Requests: {{pendingRequests}}\nUpcoming Deadlines: {{upcomingDeadlines}}\nCurrent Sprint: {{sprintInfo}}',
      }],
    },
    {
      promptKey: 'github.daily_summary',
      title: 'GitHub Daily Commit Summary',
      description: 'Summarize daily GitHub commits for a project',
      category: 'DASHBOARD',
      versions: [{
        systemPrompt: 'You are a software development activity analyst. Given a list of git commits from a project for a specific day, provide a concise summary in Thai language. Include: key changes made, areas of the codebase affected, potential risks or concerns, and notable contributions. Keep it brief and actionable.',
        userPromptTemplate: 'Summarize the following commits for project {{projectName}} (AIT No: {{aitNo}}) on {{date}}:\n\nCommits:\n{{commits}}',
      }],
    },
  ]

  for (const pDef of promptDefs) {
    const prompt = await db.aiPrompt.upsert({
      where: { promptKey: pDef.promptKey },
      update: { title: pDef.title, description: pDef.description, category: pDef.category, status: 'ACTIVE' },
      create: {
        promptKey: pDef.promptKey,
        title: pDef.title,
        description: pDef.description,
        category: pDef.category,
        status: 'ACTIVE',
        createdById: adminUser.id,
      },
    })

    // Create versions
    for (const vDef of pDef.versions) {
      const existingVersion = await db.aiPromptVersion.findFirst({
        where: { promptId: prompt.id, version: 1 },
      })
      if (!existingVersion) {
        await db.aiPromptVersion.create({
          data: {
            promptId: prompt.id,
            version: 1,
            systemPrompt: vDef.systemPrompt,
            userPromptTemplate: vDef.userPromptTemplate,
            temperature: 0.7,
            maxTokens: 4096,
            changeLog: 'Initial version',
            status: 'ACTIVE',
            activatedAt: new Date(),
            activatedById: adminUser.id,
          },
        })
      }
    }
  }

  // ──────────────────────────────────────────────────────────
  // 7. Create Workflow Definition for Requests
  // ──────────────────────────────────────────────────────────
  console.log('🔄 Creating workflow definition...')

  const workflowDef = await db.workflowDefinition.upsert({
    where: { id: 'default-request-workflow' },
    update: {},
    create: {
      id: 'default-request-workflow',
      name: 'Request Processing Workflow',
      description: 'Standard workflow for processing IT requests from intake to completion',
      entityType: 'REQUEST',
      isActive: true,
      version: 1,
    },
  })

  // Workflow steps
  const stepDefs = [
    { stepKey: 'DRAFT', name: 'Draft', isInitial: true, isFinal: false, order: 0, allowedRoles: '["REQUESTER","BA","ADMIN"]', slaHours: 72 },
    { stepKey: 'SUBMITTED', name: 'Submitted', isInitial: false, isFinal: false, order: 1, allowedRoles: '["REQUESTER","BA","ADMIN"]', slaHours: 24 },
    { stepKey: 'APPROVED', name: 'Approved', isInitial: false, isFinal: false, order: 2, allowedRoles: '["APPROVER","IT_MANAGER","PROJECT_MANAGER","ADMIN"]', slaHours: 48 },
    { stepKey: 'REJECTED', name: 'Rejected', isInitial: false, isFinal: true, order: 3, allowedRoles: '["APPROVER","IT_MANAGER","ADMIN"]' },
    { stepKey: 'ASSIGNED', name: 'Assigned', isInitial: false, isFinal: false, order: 4, allowedRoles: '["IT_MANAGER","PROJECT_MANAGER","BA","ADMIN"]', autoAssignToRole: 'BA', slaHours: 24 },
    { stepKey: 'IN_DEVELOPMENT', name: 'In Development', isInitial: false, isFinal: false, order: 5, allowedRoles: '["DEVELOPER","FULLSTACK","ADMIN"]', slaHours: 168 },
    { stepKey: 'QA', name: 'QA Testing', isInitial: false, isFinal: false, order: 6, allowedRoles: '["QA","FULLSTACK","ADMIN"]', slaHours: 72 },
    { stepKey: 'UAT', name: 'UAT', isInitial: false, isFinal: false, order: 7, allowedRoles: '["QA","REQUESTER","FULLSTACK","ADMIN"]', slaHours: 96 },
    { stepKey: 'COMPLETED', name: 'Completed', isInitial: false, isFinal: false, order: 8, allowedRoles: '["PROJECT_MANAGER","IT_MANAGER","ADMIN"]', slaHours: 48 },
    { stepKey: 'CLOSED', name: 'Closed', isInitial: false, isFinal: true, order: 9, allowedRoles: '["PROJECT_MANAGER","IT_MANAGER","ADMIN"]' },
  ]

  const stepMap: Record<string, string> = {}
  for (const sDef of stepDefs) {
    const step = await db.workflowStep.upsert({
      where: {
        workflowDefId_stepKey: {
          workflowDefId: workflowDef.id,
          stepKey: sDef.stepKey,
        },
      },
      update: { name: sDef.name },
      create: {
        workflowDefId: workflowDef.id,
        name: sDef.name,
        stepKey: sDef.stepKey,
        isInitial: sDef.isInitial,
        isFinal: sDef.isFinal,
        order: sDef.order,
        allowedRoles: sDef.allowedRoles,
        autoAssignToRole: (sDef as any).autoAssignToRole,
        slaHours: (sDef as any).slaHours,
      },
    })
    stepMap[sDef.stepKey] = step.id
  }

  // Workflow transitions
  const transitionDefs = [
    { from: 'DRAFT', to: 'SUBMITTED', action: 'submit', allowedRoles: '["REQUESTER","BA","ADMIN"]' },
    { from: 'SUBMITTED', to: 'APPROVED', action: 'approve', allowedRoles: '["APPROVER","IT_MANAGER","PROJECT_MANAGER","ADMIN"]', requiresComment: false },
    { from: 'SUBMITTED', to: 'REJECTED', action: 'reject', allowedRoles: '["APPROVER","IT_MANAGER","ADMIN"]', requiresComment: true },
    { from: 'SUBMITTED', to: 'DRAFT', action: 'return_to_draft', allowedRoles: '["APPROVER","ADMIN"]' },
    { from: 'APPROVED', to: 'ASSIGNED', action: 'assign', allowedRoles: '["IT_MANAGER","PROJECT_MANAGER","ADMIN"]' },
    { from: 'ASSIGNED', to: 'IN_DEVELOPMENT', action: 'start_development', allowedRoles: '["DEVELOPER","FULLSTACK","ADMIN"]' },
    { from: 'IN_DEVELOPMENT', to: 'QA', action: 'submit_for_qa', allowedRoles: '["DEVELOPER","FULLSTACK","ADMIN"]' },
    { from: 'IN_DEVELOPMENT', to: 'ASSIGNED', action: 'return_to_assigned', allowedRoles: '["DEVELOPER","FULLSTACK","ADMIN"]', requiresComment: true },
    { from: 'QA', to: 'UAT', action: 'submit_for_uat', allowedRoles: '["QA","FULLSTACK","ADMIN"]' },
    { from: 'QA', to: 'IN_DEVELOPMENT', action: 'return_to_dev', allowedRoles: '["QA","FULLSTACK","ADMIN"]', requiresComment: true },
    { from: 'UAT', to: 'COMPLETED', action: 'sign_off', allowedRoles: '["REQUESTER","PROJECT_MANAGER","FULLSTACK","ADMIN"]' },
    { from: 'UAT', to: 'IN_DEVELOPMENT', action: 'fail_uat', allowedRoles: '["QA","REQUESTER","FULLSTACK","ADMIN"]', requiresComment: true },
    { from: 'COMPLETED', to: 'CLOSED', action: 'close', allowedRoles: '["PROJECT_MANAGER","IT_MANAGER","ADMIN"]' },
    { from: 'COMPLETED', to: 'ASSIGNED', action: 'reopen', allowedRoles: '["PROJECT_MANAGER","IT_MANAGER","ADMIN"]', requiresComment: true },
  ]

  for (const tDef of transitionDefs) {
    await db.workflowTransition.upsert({
      where: { id: `${workflowDef.id}-${tDef.from}-${tDef.to}-${tDef.action}` },
      update: {},
      create: {
        id: `${workflowDef.id}-${tDef.from}-${tDef.to}-${tDef.action}`,
        workflowDefId: workflowDef.id,
        fromStepId: stepMap[tDef.from],
        toStepId: stepMap[tDef.to],
        action: tDef.action,
        allowedRoles: tDef.allowedRoles,
        requiresComment: tDef.requiresComment ?? false,
      },
    })
  }

  // ──────────────────────────────────────────────────────────
  // 8. Create Meeting Bot Accounts
  // ──────────────────────────────────────────────────────────
  console.log('🤖 Creating meeting bot accounts...')

  const botAccounts = [
    { email: 'ai-bot-1@enterprise.com', name: 'AI Meeting Bot 1' },
    { email: 'ai-bot-2@enterprise.com', name: 'AI Meeting Bot 2' },
  ]

  for (const bot of botAccounts) {
    await db.meetingBotAccount.upsert({
      where: { email: bot.email },
      update: {},
      create: {
        email: bot.email,
        name: bot.name,
        status: 'AVAILABLE',
      },
    })
  }

  // ──────────────────────────────────────────────────────────
  // 9. Create Sample Project
  // ──────────────────────────────────────────────────────────
  console.log('📋 Creating sample project...')

  const sampleProject = await db.project.upsert({
    where: { code: 'AIT2605-001' },
    update: {},
    create: {
      code: 'AIT2605-001',
      name: 'Enterprise Portal Upgrade',
      description: 'Major upgrade of the enterprise portal including new UI framework, enhanced security, and AI-powered features.',
      status: 'ACTIVE',
      startDate: new Date('2024-01-15'),
      endDate: new Date('2024-12-31'),
      createdById: adminUser.id,
    },
  })

  // Add project members
  const projectMembers = [
    { userId: userMap['it_manager'] || adminUser.id, role: 'PROJECT_MANAGER' },
    { userId: userMap['project_manager'] || adminUser.id, role: 'LEAD' },
    { userId: userMap['ba'] || adminUser.id, role: 'MEMBER' },
    { userId: userMap['developer'] || adminUser.id, role: 'MEMBER' },
    { userId: userMap['qa'] || adminUser.id, role: 'MEMBER' },
  ]

  for (const pm of projectMembers) {
    await db.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId: sampleProject.id,
          userId: pm.userId,
        },
      },
      update: {},
      create: {
        projectId: sampleProject.id,
        userId: pm.userId,
        role: pm.role,
      },
    })
  }

  // ──────────────────────────────────────────────────────────
  // 10. Create Document Number Sequences (AIT)
  // ──────────────────────────────────────────────────────────
  console.log('📄 Creating document number sequences...')

  const docNumberSeqs = [
    { documentType: 'REQUEST', prefix: 'AIT-REQ', formatTemplate: 'AIT-REQ-{YEAR}-{NUMBER}', paddingLength: 6, resetPolicy: 'YEARLY' as const },
    { documentType: 'PROJECT', prefix: 'AIT', formatTemplate: 'AIT{SHORTYEAR}{MONTH}-{NUMBER}', paddingLength: 3, resetPolicy: 'MONTHLY' as const },
    { documentType: 'MIT', prefix: 'AIT-MIT', formatTemplate: 'AIT-MIT-{YEAR}-{NUMBER}', paddingLength: 6, resetPolicy: 'YEARLY' as const },
    { documentType: 'UAT', prefix: 'AIT-UAT', formatTemplate: 'AIT-UAT-{YEAR}-{NUMBER}', paddingLength: 6, resetPolicy: 'YEARLY' as const },
    { documentType: 'BUG', prefix: 'AIT-BUG', formatTemplate: 'AIT-BUG-{YEAR}-{NUMBER}', paddingLength: 6, resetPolicy: 'YEARLY' as const },
    { documentType: 'CHANGE', prefix: 'AIT-CHG', formatTemplate: 'AIT-CHG-{YEAR}-{NUMBER}', paddingLength: 6, resetPolicy: 'YEARLY' as const },
    { documentType: 'APPROVAL', prefix: 'AIT-APR', formatTemplate: 'AIT-APR-{YEAR}-{NUMBER}', paddingLength: 6, resetPolicy: 'YEARLY' as const },
    { documentType: 'MA', prefix: 'AIT-MA', formatTemplate: 'AIT-MA-{YEAR}-{NUMBER}', paddingLength: 6, resetPolicy: 'YEARLY' as const },
  ]

  for (const seq of docNumberSeqs) {
    await db.documentNumberSequence.upsert({
      where: { documentType: seq.documentType },
      update: {},
      create: {
        documentType: seq.documentType,
        prefix: seq.prefix,
        year: new Date().getFullYear(),
        currentNumber: 0,
        paddingLength: seq.paddingLength,
        formatTemplate: seq.formatTemplate,
        resetPolicy: seq.resetPolicy,
        isActive: true,
      },
    })
  }

  // ──────────────────────────────────────────────────────────
  // 11. Create Notification Rules
  // ──────────────────────────────────────────────────────────
  console.log('🔔 Creating notification rules...')

  const notificationRules = [
    { eventKey: 'REQUEST_SUBMITTED', name: 'Request Submitted', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ALL_ADMINS' },
    { eventKey: 'REQUEST_WAITING_APPROVAL', name: 'Request Waiting Approval', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ASSIGNED_ROLE' },
    { eventKey: 'REQUEST_APPROVED', name: 'Request Approved', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'CREATOR' },
    { eventKey: 'REQUEST_REJECTED', name: 'Request Rejected', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'CREATOR' },
    { eventKey: 'PROJECT_CREATED', name: 'Project Created', channels: '["IN_APP"]', recipientStrategy: 'ALL_ADMINS' },
    { eventKey: 'PROJECT_MEMBER_ADDED', name: 'Project Member Added', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ASSIGNEE' },
    { eventKey: 'MIT_ASSIGNED', name: 'MIT Assigned', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ASSIGNEE' },
    { eventKey: 'MIT_ACCEPTED', name: 'MIT Accepted', channels: '["IN_APP"]', recipientStrategy: 'CREATOR' },
    { eventKey: 'MIT_RETURNED', name: 'MIT Returned', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ASSIGNEE' },
    { eventKey: 'MIT_SUBMITTED', name: 'MIT Submitted', channels: '["IN_APP"]', recipientStrategy: 'CREATOR' },
    { eventKey: 'HANDOFF_PENDING', name: 'Handoff Pending', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ASSIGNEE' },
    { eventKey: 'TASK_ASSIGNED', name: 'Task Assigned', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ASSIGNEE' },
    { eventKey: 'UAT_DEFECT_CREATED', name: 'UAT Defect Created', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ASSIGNED_ROLE' },
    { eventKey: 'APPROVAL_PENDING_TOO_LONG', name: 'Approval Pending Too Long', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ALL_ADMINS' },
    { eventKey: 'GITHUB_DAILY_SUMMARY_READY', name: 'GitHub Daily Summary Ready', channels: '["IN_APP"]', recipientStrategy: 'ASSIGNED_ROLE' },
    { eventKey: 'SYSTEM_ANNOUNCEMENT', name: 'System Announcement', channels: '["IN_APP","EMAIL"]', recipientStrategy: 'ALL_ADMINS' },
  ]

  for (const rule of notificationRules) {
    await db.notificationRule.upsert({
      where: { eventKey: rule.eventKey },
      update: { name: rule.name },
      create: {
        eventKey: rule.eventKey,
        name: rule.name,
        channels: rule.channels,
        recipientStrategy: rule.recipientStrategy,
        isActive: true,
      },
    })
  }

  // ──────────────────────────────────────────────────────────
  // 12. Create Email Templates
  // ──────────────────────────────────────────────────────────
  console.log('📧 Creating email templates...')

  const emailTemplates = [
    {
      templateKey: 'request_submitted',
      name: 'Request Submitted',
      subjectTemplate: '[{{aitNo}}] New Request Submitted: {{title}}',
      bodyHtmlTemplate: '<h2>New Request Submitted</h2><p>A new request has been submitted and is waiting for review.</p><p><strong>AIT No:</strong> {{aitNo}}</p><p><strong>Title:</strong> {{title}}</p><p><strong>Priority:</strong> {{priority}}</p><p><strong>Submitted by:</strong> {{submitterName}}</p><p><a href="{{link}}">View Request</a></p>',
      variablesJson: '["aitNo","title","priority","submitterName","link"]',
    },
    {
      templateKey: 'request_waiting_approval',
      name: 'Request Waiting Approval',
      subjectTemplate: '[{{aitNo}}] Approval Required: {{title}}',
      bodyHtmlTemplate: '<h2>Approval Required</h2><p>A request is waiting for your approval.</p><p><strong>AIT No:</strong> {{aitNo}}</p><p><strong>Title:</strong> {{title}}</p><p><strong>Priority:</strong> {{priority}}</p><p><a href="{{link}}">Review & Approve</a></p>',
      variablesJson: '["aitNo","title","priority","link"]',
    },
    {
      templateKey: 'request_approved',
      name: 'Request Approved',
      subjectTemplate: '[{{aitNo}}] Request Approved: {{title}}',
      bodyHtmlTemplate: '<h2>Request Approved</h2><p>Your request has been approved.</p><p><strong>AIT No:</strong> {{aitNo}}</p><p><strong>Title:</strong> {{title}}</p><p><a href="{{link}}">View Request</a></p>',
      variablesJson: '["aitNo","title","link"]',
    },
    {
      templateKey: 'request_rejected',
      name: 'Request Rejected',
      subjectTemplate: '[{{aitNo}}] Request Rejected: {{title}}',
      bodyHtmlTemplate: '<h2>Request Rejected</h2><p>Your request has been rejected.</p><p><strong>AIT No:</strong> {{aitNo}}</p><p><strong>Title:</strong> {{title}}</p><p><strong>Reason:</strong> {{reason}}</p><p><a href="{{link}}">View Request</a></p>',
      variablesJson: '["aitNo","title","reason","link"]',
    },
    {
      templateKey: 'mit_assigned',
      name: 'MIT Assigned',
      subjectTemplate: '[{{aitNo}}] MIT Assignment: {{title}}',
      bodyHtmlTemplate: '<h2>New MIT Assignment</h2><p>You have been assigned a new MIT item.</p><p><strong>AIT No:</strong> {{aitNo}}</p><p><strong>Title:</strong> {{title}}</p><p><strong>Step:</strong> {{step}}</p><p><a href="{{link}}">View MIT Item</a></p>',
      variablesJson: '["aitNo","title","step","link"]',
    },
    {
      templateKey: 'handoff_pending',
      name: 'Handoff Pending',
      subjectTemplate: '[{{aitNo}}] Handoff Pending: {{title}}',
      bodyHtmlTemplate: '<h2>Handoff Pending</h2><p>A work item handoff is pending your acceptance.</p><p><strong>AIT No:</strong> {{aitNo}}</p><p><strong>Title:</strong> {{title}}</p><p><strong>From:</strong> {{fromRole}}</p><p><strong>To:</strong> {{toRole}}</p><p><a href="{{link}}">Review Handoff</a></p>',
      variablesJson: '["aitNo","title","fromRole","toRole","link"]',
    },
    {
      templateKey: 'github_daily_summary',
      name: 'GitHub Daily Summary',
      subjectTemplate: '[{{aitNo}}] Daily Commit Summary - {{projectName}}',
      bodyHtmlTemplate: '<h2>Daily Commit Summary</h2><p><strong>Project:</strong> {{projectName}} ({{aitNo}})</p><p><strong>Date:</strong> {{date}}</p><p><strong>Total Commits:</strong> {{totalCommits}}</p><div>{{summary}}</div>',
      variablesJson: '["aitNo","projectName","date","totalCommits","summary"]',
    },
    {
      templateKey: 'approval_sla_overdue',
      name: 'Approval SLA Overdue',
      subjectTemplate: '[{{aitNo}}] Overdue Approval: {{title}}',
      bodyHtmlTemplate: '<h2>Approval Overdue</h2><p>An approval has exceeded the SLA time limit.</p><p><strong>AIT No:</strong> {{aitNo}}</p><p><strong>Title:</strong> {{title}}</p><p><strong>Waiting since:</strong> {{sinceDate}}</p><p><a href="{{link}}">Review Now</a></p>',
      variablesJson: '["aitNo","title","sinceDate","link"]',
    },
  ]

  for (const tpl of emailTemplates) {
    await db.emailTemplate.upsert({
      where: { templateKey: tpl.templateKey },
      update: { name: tpl.name },
      create: {
        templateKey: tpl.templateKey,
        name: tpl.name,
        subjectTemplate: tpl.subjectTemplate,
        bodyHtmlTemplate: tpl.bodyHtmlTemplate,
        variablesJson: tpl.variablesJson,
        isActive: true,
      },
    })
  }

  // ──────────────────────────────────────────────────────────
  // 13. Create System Settings
  // ──────────────────────────────────────────────────────────
  console.log('⚙️ Creating system settings...')

  const systemSettings = [
    { key: 'system.name', value: '"Enterprise AI Workflow Platform"', valueType: 'STRING', category: 'GENERAL', description: 'System display name' },
    { key: 'system.logoUrl', value: '""', valueType: 'STRING', category: 'GENERAL', description: 'System logo URL' },
    { key: 'system.baseUrl', value: JSON.stringify(appUrl), valueType: 'STRING', category: 'GENERAL', description: 'Application base URL' },
    { key: 'auth.accessTokenMinutes', value: '15', valueType: 'NUMBER', category: 'AUTH', description: 'Access token expiry in minutes' },
    { key: 'auth.refreshTokenDays', value: '7', valueType: 'NUMBER', category: 'AUTH', description: 'Refresh token expiry in days' },
    { key: 'notification.defaultEmailEnabled', value: 'true', valueType: 'BOOLEAN', category: 'NOTIFICATION', description: 'Enable email notifications by default' },
    { key: 'github.dailySummaryEnabled', value: 'false', valueType: 'BOOLEAN', category: 'GITHUB', description: 'Enable daily GitHub commit summary generation' },
    { key: 'github.dailySummaryTime', value: '"18:00"', valueType: 'STRING', category: 'GITHUB', description: 'Time to generate daily commit summary (HH:mm)' },
    { key: 'workflow.approvalSlaHours', value: '48', valueType: 'NUMBER', category: 'WORKFLOW', description: 'Default approval SLA in hours' },
    { key: 'mit.assignmentAutoNotify', value: 'true', valueType: 'BOOLEAN', category: 'WORKFLOW', description: 'Auto-notify on MIT assignment' },
    { key: 'ai.provider', value: '"default"', valueType: 'STRING', category: 'AI', description: 'Default AI provider' },
    { key: 'ai.enablePromptStudio', value: 'true', valueType: 'BOOLEAN', category: 'AI', description: 'Enable AI Prompt Studio' },
    { key: 'documentNumber.defaultPrefix', value: '"AIT"', valueType: 'STRING', category: 'DOCUMENT_NUMBER', description: 'Default document number prefix' },
    { key: 'documentNumber.resetPolicy', value: '"YEARLY"', valueType: 'STRING', category: 'DOCUMENT_NUMBER', description: 'Running number reset policy' },
    { key: 'security.auditLogRetentionDays', value: '365', valueType: 'NUMBER', category: 'SECURITY', description: 'Audit log retention in days' },
  ]

  for (const setting of systemSettings) {
    await db.systemSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: {
        key: setting.key,
        value: setting.value,
        valueType: setting.valueType,
        category: setting.category,
        description: setting.description,
        isSecret: false,
      },
    })
  }

  // ──────────────────────────────────────────────────────────
  // 14. Create Approval Workflows
  // ──────────────────────────────────────────────────────────
  console.log('✅ Creating approval workflows...')

  const requestApprovalWorkflow = await db.approvalWorkflow.upsert({
    where: { workflowKey: 'request-approval' },
    update: {},
    create: {
      workflowKey: 'request-approval',
      entityType: 'REQUEST',
      name: 'Request Approval Workflow',
      description: 'Standard multi-step approval for IT requests',
      isActive: true,
    },
  })

  // Approval steps
  const approvalStepDefs = [
    { stepOrder: 1, stepName: 'IT Manager Review', approverRole: 'IT_MANAGER', requiredAction: 'REVIEW', isRequired: true, slaHours: 24 },
    { stepOrder: 2, stepName: 'Approver Decision', approverRole: 'APPROVER', requiredAction: 'APPROVE', isRequired: true, slaHours: 48 },
  ]

  for (const asd of approvalStepDefs) {
    await db.approvalStep.upsert({
      where: { id: `${requestApprovalWorkflow.id}-step-${asd.stepOrder}` },
      update: {},
      create: {
        id: `${requestApprovalWorkflow.id}-step-${asd.stepOrder}`,
        workflowId: requestApprovalWorkflow.id,
        stepOrder: asd.stepOrder,
        stepName: asd.stepName,
        approverRole: asd.approverRole,
        requiredAction: asd.requiredAction,
        isRequired: asd.isRequired,
        slaHours: asd.slaHours,
      },
    })
  }

  // Change request approval workflow
  const changeApprovalWorkflow = await db.approvalWorkflow.upsert({
    where: { workflowKey: 'change-approval' },
    update: {},
    create: {
      workflowKey: 'change-approval',
      entityType: 'CHANGE',
      name: 'Change Request Approval Workflow',
      description: 'Approval workflow for change requests',
      isActive: true,
    },
  })

  const changeApprovalSteps = [
    { stepOrder: 1, stepName: 'IT Manager Review', approverRole: 'IT_MANAGER', requiredAction: 'REVIEW', isRequired: true, slaHours: 24 },
    { stepOrder: 2, stepName: 'Change Board Approval', approverRole: 'APPROVER', requiredAction: 'APPROVE', isRequired: true, slaHours: 48 },
  ]

  for (const cas of changeApprovalSteps) {
    await db.approvalStep.upsert({
      where: { id: `${changeApprovalWorkflow.id}-step-${cas.stepOrder}` },
      update: {},
      create: {
        id: `${changeApprovalWorkflow.id}-step-${cas.stepOrder}`,
        workflowId: changeApprovalWorkflow.id,
        stepOrder: cas.stepOrder,
        stepName: cas.stepName,
        approverRole: cas.approverRole,
        requiredAction: cas.requiredAction,
        isRequired: cas.isRequired,
        slaHours: cas.slaHours,
      },
    })
  }

  // ──────────────────────────────────────────────────────────
  // 15. Create Background Jobs
  // ──────────────────────────────────────────────────────────
  console.log('⏰ Creating background jobs...')

  const backgroundJobs = [
    { jobKey: 'github.commit.sync.daily', name: 'Daily GitHub Commit Sync', description: 'Sync GitHub commits for all connected repositories', schedule: '0 9 * * *', isEnabled: false },
    { jobKey: 'github.commit.summary.generate.daily', name: 'Daily Commit Summary', description: 'Generate AI summary of daily commits per project', schedule: '0 18 * * *', isEnabled: false },
    { jobKey: 'notification.email.dispatch', name: 'Email Notification Dispatch', description: 'Send queued email notifications', schedule: '*/5 * * * *', isEnabled: true },
    { jobKey: 'approval.sla.check', name: 'Approval SLA Check', description: 'Check for overdue approvals and notify', schedule: '0 */4 * * *', isEnabled: true },
    { jobKey: 'project.health.recalculate', name: 'Project Health Recalculation', description: 'Recalculate health scores for active projects', schedule: '0 8 * * *', isEnabled: true },
    { jobKey: 'overdue.item.check', name: 'Overdue Item Check', description: 'Check for overdue work items and notify', schedule: '0 9 * * *', isEnabled: true },
  ]

  for (const job of backgroundJobs) {
    await db.backgroundJob.upsert({
      where: { jobKey: job.jobKey },
      update: { name: job.name },
      create: {
        jobKey: job.jobKey,
        name: job.name,
        description: job.description,
        schedule: job.schedule,
        isEnabled: job.isEnabled,
      },
    })
  }

  console.log('\n✅ Seed completed successfully!')
  console.log('\n📋 Default credentials:')
  console.log('   Admin: admin@enterprise.com / admin123')
  console.log('   Sample users: {role}@enterprise.com / password123')
  console.log('   (e.g., itmanager@enterprise.com, pm@enterprise.com, ba@enterprise.com, etc.)')
}

export { seed }
