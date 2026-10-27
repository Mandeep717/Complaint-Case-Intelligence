import axios from 'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_BASE_URL||'http://localhost:4000/api/v1'});
api.interceptors.request.use(config=>{const token=localStorage.getItem('ps26264-token');if(token)config.headers.Authorization=`Bearer ${token}`;return config});
export const errorText=(e:any)=>e?.response?.data?.error||'Something went wrong. Please retry.';
