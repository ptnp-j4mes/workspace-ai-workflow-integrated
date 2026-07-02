import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'

import { activityDailyRoutes } from './routes/activity-daily'
import { adminRoutes } from './routes/admin'
import { aiRoutes } from './routes/ai'
import { approvalInstancesRoutes } from './routes/approval-instances'
import { authRoutes } from './routes/auth'
import { bugsRoutes } from './routes/bugs'
import { calendarRoutes } from './routes/calendar'
import { changeRequestsRoutes } from './routes/change-requests'
import { dashboardRoutes } from './routes/dashboard'
import { documentNumbersRoutes } from './routes/document-numbers'
import { maintenanceRoutes } from './routes/maintenance'
import { masterRoutes } from './routes/master'
import { meRoutes } from './routes/me'
import { meetingsRoutes } from './routes/meetings'
import { menusRoutes } from './routes/menus'
import { notificationsRoutes } from './routes/notifications'
import { platformRequestsRoutes } from './routes/platform-requests'
import { projectsRoutes } from './routes/projects'
import { reportsRoutes } from './routes/reports'
import { requestsRoutes } from './routes/requests'
import { searchRoutes } from './routes/search'
import { uatRoutes } from './routes/uat'
import { usersRoutes } from './routes/users'
import { workItemsRoutes } from './routes/work-items'

const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:3002'

export const app = new Elysia()
  .use(
    cors({
      origin: CORS_ORIGIN,
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type'],
    })
  )
  .get('/api/health', () => ({ status: 'ok' }))
  .use(activityDailyRoutes)
  .use(adminRoutes)
  .use(aiRoutes)
  .use(approvalInstancesRoutes)
  .use(authRoutes)
  .use(bugsRoutes)
  .use(calendarRoutes)
  .use(changeRequestsRoutes)
  .use(dashboardRoutes)
  .use(documentNumbersRoutes)
  .use(maintenanceRoutes)
  .use(masterRoutes)
  .use(meRoutes)
  .use(meetingsRoutes)
  .use(menusRoutes)
  .use(notificationsRoutes)
  .use(platformRequestsRoutes)
  .use(projectsRoutes)
  .use(reportsRoutes)
  .use(requestsRoutes)
  .use(searchRoutes)
  .use(uatRoutes)
  .use(usersRoutes)
  .use(workItemsRoutes)
