// Placeholder for API client
export class PennyAPIClient {
  constructor(
    private baseURL: string,
    private token?: string,
  ) {}

  async login(email: string, password: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseURL}/api/v1/auth/login`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }
}
