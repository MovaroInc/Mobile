import { api } from './api';

export const getEntityById = async (
  id: number,
  mode: 'customer' | 'vendor',
) => {
  console.log('getEntityById', id, mode);
  const res = await api.get<{
    success: boolean;
    data: any | null;
    error: any | null;
    message: string | null;
  }>(`/entity/get-entity-by-id/${id}/${mode}`);
  return res.data;
};
