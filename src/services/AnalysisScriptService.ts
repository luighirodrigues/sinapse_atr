import { AnalysisScriptRepository } from '../repositories/AnalysisScriptRepository';

export type CreateAnalysisScriptRequest = {
  clientId: string;
  scriptKey: string;
  version?: number;
  name: string;
  description?: string | null;
  scriptText: string;
  topics?: unknown;
  isActive?: boolean;
};

export class AnalysisScriptService {
  private repo: AnalysisScriptRepository;

  constructor() {
    this.repo = new AnalysisScriptRepository();
  }

  async create(input: CreateAnalysisScriptRequest) {
    const version =
      input.version != null
        ? input.version
        : await this.repo.getNextVersion(input.clientId, input.scriptKey);

    const isActive = input.isActive ?? true;
    const topics = Array.isArray(input.topics) ? input.topics : [];

    return this.repo.create({
      clientId: input.clientId,
      scriptKey: input.scriptKey,
      version,
      name: input.name,
      description: input.description ?? null,
      scriptText: input.scriptText,
      topics,
      isActive,
    });
  }

  async list(clientId: string, filter?: { scriptKey?: string; activeOnly?: boolean }) {
    return this.repo.list(clientId, filter);
  }

  async resolve(clientId: string, scriptKey: string, version?: number) {
    if (version != null) {
      return this.repo.findByKeyVersion(clientId, scriptKey, version);
    }
    return this.repo.findActiveHighestVersion(clientId, scriptKey);
  }

  async activate(clientId: string, scriptKey: string, version: number, deactivateOthers: boolean = true) {
    return this.repo.activate(clientId, scriptKey, version, deactivateOthers);
  }
}

