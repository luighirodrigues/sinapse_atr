import { Router, Request, Response, NextFunction } from 'express';
import { JobController } from '../controllers/JobController';
import { TicketController } from '../controllers/TicketController';
import { ClientController } from '../controllers/ClientController';
import { env } from '../config/env';

const router = Router();
const jobController = new JobController();
const ticketController = new TicketController();
const clientController = new ClientController();

const adminAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['authorization'] || req.headers['x-admin-token'];
  const expected = env.ADMIN_TOKEN;
  if (token === expected || token === `Bearer ${expected}`) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized' });
};

router.post('/jobs/import', adminAuth, (req, res) => jobController.import(req, res));
router.post('/jobs/import/:slug', adminAuth, (req, res) => jobController.import(req, res));

router.get('/clients', adminAuth, (req, res) => clientController.list(req, res));
router.post('/clients', adminAuth, (req, res) => clientController.create(req, res));
router.patch('/clients/:id', adminAuth, (req, res) => clientController.update(req, res));

router.get('/tickets/:uuid', (req, res) => ticketController.get(req, res));
router.get('/health', (req, res) => res.json({ status: 'ok' }));

export default router;
