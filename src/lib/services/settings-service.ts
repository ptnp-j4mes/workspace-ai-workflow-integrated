// ============================================================
// Settings Service - System Settings Management
// ============================================================

import { db } from '@/lib/db'
import { logAudit } from './audit-service'

/**
 * Get a setting raw value by key, bypassing secret masking. Returns null if not found.
 * Use with caution — only for backend operations that need the actual value.
 */
export async function getRawSetting(key: string): Promise<string | null> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key },
    })
    return setting?.value ?? null
  } catch (error) {
    console.error('[SettingsService] Error getting raw setting:', error)
    return null
  }
}

/**
 * Get a setting value by key. Returns null if not found.
 */
export async function getSetting(key: string): Promise<string | null> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key },
    })

    if (!setting) return null
    if (setting.isSecret) return '***'

    return setting.value
  } catch (error) {
    console.error('[SettingsService] Error getting setting:', error)
    return null
  }
}

/**
 * Get a setting value and parse it as a typed value.
 */
export async function getSettingTyped<T>(key: string): Promise<T | null> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key },
    })

    if (!setting) return null
    if (setting.isSecret) return null

    switch (setting.valueType) {
      case 'NUMBER':
        return Number(setting.value) as unknown as T
      case 'BOOLEAN':
        return (setting.value === 'true') as unknown as T
      case 'JSON':
        try {
          return JSON.parse(setting.value) as T
        } catch {
          return null
        }
      default:
        return setting.value as unknown as T
    }
  } catch (error) {
    console.error('[SettingsService] Error getting typed setting:', error)
    return null
  }
}

/**
 * Set a setting value. Creates the setting if it doesn't exist.
 */
export async function setSetting(
  key: string,
  value: string,
  userId?: string
): Promise<void> {
  try {
    const existing = await db.systemSetting.findUnique({ where: { key } })

    if (existing) {
      await db.systemSetting.update({
        where: { key },
        data: {
          value,
          updatedById: userId ?? null,
        },
      })

      if (userId) {
        await logAudit({
          userId,
          action: 'UPDATE_SETTING',
          entity: 'SystemSetting',
          entityId: key,
          oldValue: { value: existing.isSecret ? '***' : existing.value },
          newValue: { value: existing.isSecret ? '***' : value },
        })
      }
    } else {
      await db.systemSetting.create({
        data: {
          key,
          value,
          valueType: 'STRING',
          category: 'GENERAL',
          updatedById: userId ?? null,
        },
      })

      if (userId) {
        await logAudit({
          userId,
          action: 'CREATE_SETTING',
          entity: 'SystemSetting',
          entityId: key,
          newValue: { value },
        })
      }
    }
  } catch (error) {
    console.error('[SettingsService] Error setting value:', error)
    throw error
  }
}

/**
 * Get all settings for a specific category.
 */
export async function getSettingsByCategory(
  category: string
): Promise<Record<string, unknown>> {
  try {
    const settings = await db.systemSetting.findMany({
      where: { category },
    })

    const result: Record<string, unknown> = {}
    for (const setting of settings) {
      if (setting.isSecret) {
        result[setting.key] = '***'
        continue
      }

      switch (setting.valueType) {
        case 'NUMBER':
          result[setting.key] = Number(setting.value)
          break
        case 'BOOLEAN':
          result[setting.key] = setting.value === 'true'
          break
        case 'JSON':
          try {
            result[setting.key] = JSON.parse(setting.value)
          } catch {
            result[setting.key] = setting.value
          }
          break
        default:
          result[setting.key] = setting.value
      }
    }

    return result
  } catch (error) {
    console.error('[SettingsService] Error getting settings by category:', error)
    return {}
  }
}

/**
 * Get all settings grouped by category.
 */
export async function getAllSettings(): Promise<Record<string, unknown>> {
  try {
    const settings = await db.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    const result: Record<string, unknown> = {}
    for (const setting of settings) {
      const categoryGroup = (result[setting.category] as Record<string, unknown>) ?? {}
      if (!result[setting.category]) {
        result[setting.category] = categoryGroup
      }

      if (setting.isSecret) {
        categoryGroup[setting.key] = '***'
        continue
      }

      switch (setting.valueType) {
        case 'NUMBER':
          categoryGroup[setting.key] = Number(setting.value)
          break
        case 'BOOLEAN':
          categoryGroup[setting.key] = setting.value === 'true'
          break
        case 'JSON':
          try {
            categoryGroup[setting.key] = JSON.parse(setting.value)
          } catch {
            categoryGroup[setting.key] = setting.value
          }
          break
        default:
          categoryGroup[setting.key] = setting.value
      }
    }

    return result
  } catch (error) {
    console.error('[SettingsService] Error getting all settings:', error)
    return {}
  }
}
