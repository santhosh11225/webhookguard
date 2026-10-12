import { IEndpointRepository } from '../repositories/interfaces/IEndpointRepository.js';
import { Endpoint, EndpointCreateDTO, EndpointUpdateDTO } from '../models/types.js';

export class EndpointService {
  constructor(private endpointRepo: IEndpointRepository) {}

  async create(data: EndpointCreateDTO): Promise<Endpoint> {
    if (!data.name || !data.name.trim()) {
      throw new Error('Endpoint name is required');
    }
    if (!data.url || !data.url.trim()) {
      throw new Error('Webhook URL is required');
    }
    try {
      new URL(data.url);
    } catch {
      throw new Error('Invalid Webhook URL format');
    }

    return this.endpointRepo.create(data);
  }

  async findById(id: string): Promise<Endpoint | null> {
    return this.endpointRepo.findById(id);
  }

  async findAll(): Promise<Endpoint[]> {
    return this.endpointRepo.findAll();
  }

  async update(id: string, data: EndpointUpdateDTO): Promise<Endpoint | null> {
    if (data.url) {
      try {
        new URL(data.url);
      } catch {
        throw new Error('Invalid Webhook URL format');
      }
    }
    return this.endpointRepo.update(id, data);
  }

  async delete(id: string): Promise<boolean> {
    return this.endpointRepo.delete(id);
  }
}
