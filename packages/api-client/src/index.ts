// Placeholder for API client
export class PennyAPIClient {
  constructor(
    private baseURL: string,
    private token?: string,
  ) {}

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseURL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  }
}
