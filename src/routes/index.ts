import { Router, Request, Response, NextFunction } from 'express';
import { JobController } from '../controllers/JobController';
import { TicketController } from '../controllers/TicketController';
import { ClientController } from '../controllers/ClientController';
import { KpiController } from '../controllers/KpiController';
import { AdminController } from '../controllers/AdminController';
import { AnalysisAdminController } from '../controllers/AnalysisAdminController';
import { AnalysisTenantController } from '../controllers/AnalysisTenantController';
import { requireAdminToken } from '../middlewares/requireAdminToken';

const router = Router();
const jobController = new JobController();
const ticketController = new TicketController();
const clientController = new ClientController();
const kpiController = new KpiController();
const adminController = new AdminController();
const analysisAdminController = new AnalysisAdminController();
const analysisTenantController = new AnalysisTenantController();

router.post('/jobs/import', requireAdminToken, (req, res) => jobController.import(req, res));
router.post('/jobs/import/:slug', requireAdminToken, (req, res) => jobController.import(req, res));

router.get('/clients', requireAdminToken, (req, res) => clientController.list(req, res));
router.post('/clients', requireAdminToken, (req, res) => clientController.create(req, res));
router.patch('/clients/:id', requireAdminToken, (req, res) => clientController.update(req, res));

router.post('/admin/sync/contacts', requireAdminToken, (req, res) =>
  adminController.syncContacts(req, res)
);

router.post('/admin/:clientSlug/analysis-scripts', requireAdminToken, (req, res) =>
  analysisAdminController.createScript(req, res)
);
router.get('/admin/:clientSlug/analysis-scripts', requireAdminToken, (req, res) =>
  analysisAdminController.listScripts(req, res)
);
router.post('/admin/:clientSlug/analysis-scripts/:scriptKey/activate', requireAdminToken, (req, res) =>
  analysisAdminController.activateScript(req, res)
);
router.post('/admin/:clientSlug/session-analyses/run', requireAdminToken, (req, res) =>
  analysisAdminController.runSessionAnalyses(req, res)
);

router.get('/tenant/:clientSlug/session-analyses/summary', (req, res) =>
  analysisTenantController.getSessionAnalysesSummary(req, res)
);
router.get('/tenant/:clientSlug/session-analyses/ranking', (req, res) =>
  analysisTenantController.getSessionAnalysesRanking(req, res)
);
router.get('/tenant/:clientSlug/session-analyses/details', (req, res) =>
  analysisTenantController.getSessionAnalysesDetails(req, res)
);

router.get('/tickets/:clientSlug/:uuid', (req, res) => ticketController.getByClientSlugAndUuid(req, res));
router.get('/tickets/:uuid', (req, res) => ticketController.get(req, res));

// KPIs
router.get('/kpis/avg-first-response-time', requireAdminToken, (req, res) => kpiController.getAvgFirstResponseTime(req, res));
router.post('/kpis/recompute/avg-first-response-time', requireAdminToken, (req, res) => kpiController.recomputeAvgFirstResponseTime(req, res));
router.get('/kpis/avg-session-duration-by-tag', requireAdminToken, (req, res) =>
  kpiController.getAvgSessionDurationByTag(req, res)
);
router.get('/kpis/top-slowest-sessions-by-tag', requireAdminToken, (req, res) =>
  kpiController.getTopSlowestSessionsByTag(req, res)
);
router.get('/tenants/:tenantSlug/kpis/consolidated-sales/summary', requireAdminToken, (req, res) =>
  kpiController.getConsolidatedSalesSummary(req, res)
);
router.get('/tenants/:tenantSlug/kpis/consolidated-sales/daily', requireAdminToken, (req, res) =>
  kpiController.getConsolidatedSalesDaily(req, res)
);
router.get('/tenants/:tenantSlug/kpis/consolidated-sales/sellers', requireAdminToken, (req, res) =>
  kpiController.getConsolidatedSalesSellers(req, res)
);

router.get('/health', (req, res) => res.json({ status: 'ok' }));

export default router;
