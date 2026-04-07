import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL;

export const getAlerts = async () => {
  const response = await axios.get(`${API_URL}/alerts`);
  return response.data;
};