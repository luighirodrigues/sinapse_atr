import { Router, Request, Response, NextFunction } from 'express';
import { JobController } from '../controllers/JobController';
import { TicketController } from '../controllers/TicketController';
import { ClientController } from '../controllers/ClientController';
import { KpiController } from '../controllers/KpiController';
import { requireAdminToken } from '../middlewares/requireAdminToken';

const router = Router();
const jobController = new JobController();
const ticketController = new TicketController();
const clientController = new ClientController();
const kpiController = new KpiController();

router.post('/jobs/import', requireAdminToken, (req, res) => jobController.import(req, res));
router.post('/jobs/import/:slug', requireAdminToken, (req, res) => jobController.import(req, res));

router.get('/clients', requireAdminToken, (req, res) => clientController.list(req, res));
router.post('/clients', requireAdminToken, (req, res) => clientController.create(req, res));
router.patch('/clients/:id', requireAdminToken, (req, res) => clientController.update(req, res));

router.get('/tickets/:clientSlug/:uuid', (req, res) => ticketController.getByClientSlugAndUuid(req, res));
router.get('/tickets/:uuid', (req, res) => ticketController.get(req, res));

// KPIs
router.get('/kpis/avg-first-response-time', requireAdminToken, (req, res) => kpiController.getAvgFirstResponseTime(req, res));
router.post('/kpis/recompute/avg-first-response-time', requireAdminToken, (req, res) => kpiController.recomputeAvgFirstResponseTime(req, res));

router.get('/health', (req, res) => res.json({ status: 'ok' }));

export default router;
