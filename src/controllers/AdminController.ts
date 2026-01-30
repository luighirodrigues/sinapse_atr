import { Request, Response } from 'express';
import { ContactsSyncService } from '../services/ContactsSyncService';

export class AdminController {
  private contactsSync: ContactsSyncService;

  constructor() {
    this.contactsSync = new ContactsSyncService();
  }

  async syncContacts(req: Request, res: Response) {
    const clientSlug =
      (req.query.clientSlug as string | undefined) ??
      (req.body?.clientSlug as string | undefined) ??
      (req.query.slug as string | undefined) ??
      (req.body?.slug as string | undefined);

    this.contactsSync.runImport(clientSlug).catch((err) => {
      console.error('Error in manual contacts sync job:', err);
    });

    res.status(202).json({ message: 'Contacts sync job started', slug: clientSlug || 'all' });
  }
}

