import { Endpoint, EndpointCreateDTO, EndpointUpdateDTO } from '../../models/types.js';

export interface IEndpointRepository {
  create(data: EndpointCreateDTO): Promise<Endpoint>;
  findById(id: string): Promise<Endpoint | null>;
  findAll(): Promise<Endpoint[]>;
  update(id: string, data: EndpointUpdateDTO): Promise<Endpoint | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}
