import nodemailer from 'nodemailer';
import { WebClient } from '@slack/web-api';
import { EventEmitter } from 'events';
import { Alert, AlertChannel, EmailAlertConfig, SlackAlertConfig, WebhookAlertConfig } from './types';

export interface AlertingConfig {
  channels: AlertChannel[];
  defaultSeverity?: 'critical' | 'high' | 'medium' | 'low';
  rateLimiting?: {
    maxAlertsPerMinute?: number;
    maxAlertsPerHour?: number;
  };
  escalation?: {
    enabled: boolean;
    rules: Array<{
      severity: string;
      escalateAfter: number; // minutes
      escalateTo: string[]; // channel names
    }>;
  };
}

export class AlertingService extends EventEmitter {
  private config: AlertingConfig;
  private channels: Map<string, AlertChannel> = new Map();
  private alertHistory: Alert[] = [];
  private rateLimitCounters: Map<string, { minute: number; hour: number; lastReset: Date }> = new Map();
  private escalationTimers: Map<string, NodeJS.Timeout> = new Map();
  private emailTransporter?: nodemailer.Transporter;
  private slackClients: Map<string, WebClient> = new Map();

  constructor(config: AlertingConfig) {
    super();
    this.config = {
      defaultSeverity: 'medium',
      rateLimiting: {
        maxAlertsPerMinute: 10,
        maxAlertsPerHour: 100
      },
      escalation: {
        enabled: false,
        rules: []
      },
      ...config
    };

    this.initializeChannels();
  }

  private initializeChannels(): void {
    for (const channel of this.config.channels) {
      this.channels.set(channel.name, channel);
      
      switch (channel.type) {
        case 'email':
          this.initializeEmailChannel(channel);
          break;
        case 'slack':
          this.initializeSlackChannel(channel);
          break;
      }
    }
  }

  private initializeEmailChannel(channel: AlertChannel): void {
    const emailConfig = channel.config as EmailAlertConfig;
    this.emailTransporter = nodemailer.createTransporter({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: emailConfig.smtp.auth
    });
  }

  private initializeSlackChannel(channel: AlertChannel): void {
    const slackConfig = channel.config as SlackAlertConfig;
    // Extract token from webhook URL or use direct token
    const token = slackConfig.webhookUrl.includes('hooks.slack.com') 
      ? undefined 
      : slackConfig.webhookUrl;
    
    if (token) {
      const client = new WebClient(token);
      this.slackClients.set(channel.name, client);
    }
  }

  async start(): Promise<void> {
    this.emit('started');
  }

  async stop(): Promise<void> {
    // Clear all escalation timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();
    
    this.emit('stopped');
  }

  async sendAlert(alert: Omit<Alert, 'id' | 'timestamp'>): Promise<void> {
    const fullAlert: Alert = {
      ...alert,
      id: this.generateAlertId(),
      timestamp: new Date(),
      severity: alert.severity || this.config.defaultSeverity!
    };

    // Check rate limiting
    if (!this.checkRateLimit(fullAlert)) {
      this.emit('rateLimited', fullAlert);
      return;
    }

    // Add to history
    this.alertHistory.push(fullAlert);
    
    // Send to all enabled channels
    const enabledChannels = Array.from(this.channels.values()).filter(c => c.enabled);
    
    for (const channel of enabledChannels) {
      try {
        await this.sendToChannel(fullAlert, channel);
        this.emit('alertSent', { alert: fullAlert, channel: channel.name });
      } catch (error) {
        this.emit('alertFailed', { alert: fullAlert, channel: channel.name, error });
      }
    }

    // Setup escalation if enabled
    if (this.config.escalation?.enabled && fullAlert.severity === 'critical') {
      this.setupEscalation(fullAlert);
    }

    this.emit('alert', fullAlert);
  }

  private async sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailAlert(alert, channel);
        break;
      case 'slack':
        await this.sendSlackAlert(alert, channel);
        break;
      case 'webhook':
        await this.sendWebhookAlert(alert, channel);
        break;
      case 'pagerduty':
        await this.sendPagerDutyAlert(alert, channel);
        break;
    }
  }

  private async sendEmailAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not initialized');
    }

    const emailConfig = channel.config as EmailAlertConfig;
    const subject = emailConfig.subject || `[${alert.severity.toUpperCase()}] ${alert.name}`;
    
    const htmlContent = this.generateEmailTemplate(alert);
    
    await this.emailTransporter.sendMail({
      from: emailConfig.from,
      to: emailConfig.to.join(', '),
      subject,
      html: htmlContent,
      text: `${alert.name}: ${alert.message}`
    });
  }

  private async sendSlackAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    const slackConfig = channel.config as SlackAlertConfig;
    
    const color = this.getSlackColor(alert.severity);
    const attachment = {
      color,
      title: alert.name,
      text: alert.message,
      fields: [
        { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
        { title: 'Time', value: alert.timestamp.toISOString(), short: true }
      ],
      footer: 'PENNY Monitoring',
      ts: Math.floor(alert.timestamp.getTime() / 1000)
    };

    if (alert.metadata) {
      attachment.fields.push({
        title: 'Metadata',
        value: '```' + JSON.stringify(alert.metadata, null, 2) + '```',
        short: false
      });
    }

    // Try Slack Web API first, fall back to webhook
    const client = this.slackClients.get(channel.name);
    if (client) {
      await client.chat.postMessage({
        channel: slackConfig.channel,
        username: slackConfig.username || 'PENNY Monitor',
        icon_emoji: slackConfig.iconEmoji || ':warning:',
        attachments: [attachment]
      });
    } else {
      // Use webhook URL
      const response = await fetch(slackConfig.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: slackConfig.username || 'PENNY Monitor',
          icon_emoji: slackConfig.iconEmoji || ':warning:',
          channel: slackConfig.channel,
          attachments: [attachment]
        })
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }
    }
  }

  private async sendWebhookAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    const webhookConfig = channel.config as WebhookAlertConfig;
    
    const headers = {
      'Content-Type': 'application/json',
      ...webhookConfig.headers
    };

    // Add authentication
    if (webhookConfig.authentication) {
      const { type, token, username, password } = webhookConfig.authentication;
      
      if (type === 'bearer' && token) {
        headers.Authorization = `Bearer ${token}`;
      } else if (type === 'basic' && username && password) {
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers.Authorization = `Basic ${credentials}`;
      }
    }

    const payload = {
      alert,
      timestamp: new Date().toISOString(),
      service: 'penny-monitoring'
    };

    const response = await fetch(webhookConfig.url, {
      method: webhookConfig.method,
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook alert failed: ${response.statusText}`);
    }
  }

  private async sendPagerDutyAlert(alert: Alert, channel: AlertChannel): Promise<void> {
    const config = channel.config;
    
    const payload = {
      routing_key: config.integrationKey,
      event_action: alert.resolved ? 'resolve' : 'trigger',
      dedup_key: alert.id,
      payload: {
        summary: `${alert.name}: ${alert.message}`,
        severity: this.mapToPagerDutySeverity(alert.severity),
        source: 'penny-monitoring',
        component: alert.metadata?.service || 'unknown',
        group: alert.metadata?.group || 'default',
        class: alert.metadata?.class || 'alert',
        custom_details: alert.metadata
      }
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`PagerDuty alert failed: ${response.statusText}`);
    }
  }

  async resolveAlert(alertId: string, message?: string): Promise<void> {
    const alert = this.alertHistory.find(a => a.id === alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    alert.resolved = true;
    alert.resolvedAt = new Date();

    // Cancel escalation if exists
    const escalationTimer = this.escalationTimers.get(alertId);
    if (escalationTimer) {
      clearTimeout(escalationTimer);
      this.escalationTimers.delete(alertId);
    }

    // Send resolution notification
    await this.sendAlert({
      name: `RESOLVED: ${alert.name}`,
      severity: 'low',
      message: message || `Alert ${alert.name} has been resolved`,
      metadata: { originalAlert: alert, resolvedBy: 'system' },
      resolved: true
    });

    this.emit('alertResolved', alert);
  }

  // Predefined alert templates
  async sendSystemAlert(type: 'cpu' | 'memory' | 'disk' | 'network', value: number, threshold: number): Promise<void> {
    const severityMap = {
      cpu: value > 90 ? 'critical' : value > 80 ? 'high' : 'medium',
      memory: value > 95 ? 'critical' : value > 85 ? 'high' : 'medium',
      disk: value > 95 ? 'critical' : value > 90 ? 'high' : 'medium',
      network: 'medium'
    };

    await this.sendAlert({
      name: `High ${type.toUpperCase()} Usage`,
      severity: severityMap[type] as any,
      message: `${type.toUpperCase()} usage is at ${value.toFixed(1)}%, exceeding threshold of ${threshold}%`,
      metadata: { type, value, threshold, category: 'system' }
    });
  }

  async sendApplicationAlert(service: string, error: Error, context?: Record<string, any>): Promise<void> {
    await this.sendAlert({
      name: `Application Error in ${service}`,
      severity: 'high',
      message: error.message,
      metadata: {
        service,
        error: error.name,
        stack: error.stack,
        category: 'application',
        ...context
      }
    });
  }

  async sendSecurityAlert(event: string, details: Record<string, any>): Promise<void> {
    await this.sendAlert({
      name: `Security Event: ${event}`,
      severity: 'critical',
      message: `Security event detected: ${event}`,
      metadata: { ...details, category: 'security' }
    });
  }

  async sendBusinessAlert(metric: string, current: number, expected: number, context?: Record<string, any>): Promise<void> {
    const deviation = Math.abs((current - expected) / expected) * 100;
    const severity = deviation > 50 ? 'high' : deviation > 25 ? 'medium' : 'low';

    await this.sendAlert({
      name: `Business Metric Alert: ${metric}`,
      severity: severity as any,
      message: `${metric} is ${current} (expected: ${expected}, deviation: ${deviation.toFixed(1)}%)`,
      metadata: { metric, current, expected, deviation, category: 'business', ...context }
    });
  }

  // Utility methods
  private checkRateLimit(alert: Alert): boolean {
    const key = alert.name;
    const now = new Date();
    
    if (!this.rateLimitCounters.has(key)) {
      this.rateLimitCounters.set(key, { minute: 0, hour: 0, lastReset: now });
      return true;
    }

    const counter = this.rateLimitCounters.get(key)!;
    const timeSinceReset = now.getTime() - counter.lastReset.getTime();

    // Reset counters if needed
    if (timeSinceReset > 60000) { // 1 minute
      counter.minute = 0;
      if (timeSinceReset > 3600000) { // 1 hour
        counter.hour = 0;
      }
      counter.lastReset = now;
    }

    // Check limits
    const { maxAlertsPerMinute = 10, maxAlertsPerHour = 100 } = this.config.rateLimiting || {};
    
    if (counter.minute >= maxAlertsPerMinute || counter.hour >= maxAlertsPerHour) {
      return false;
    }

    counter.minute++;
    counter.hour++;
    return true;
  }

  private setupEscalation(alert: Alert): void {
    if (!this.config.escalation?.enabled) return;

    const escalationRule = this.config.escalation.rules.find(r => r.severity === alert.severity);
    if (!escalationRule) return;

    const timer = setTimeout(async () => {
      // Check if alert is still unresolved
      const currentAlert = this.alertHistory.find(a => a.id === alert.id);
      if (!currentAlert || currentAlert.resolved) return;

      // Send escalation alert
      await this.sendAlert({
        name: `ESCALATED: ${alert.name}`,
        severity: 'critical',
        message: `Alert has been escalated after ${escalationRule.escalateAfter} minutes without resolution`,
        metadata: { originalAlert: alert, escalated: true }
      });

      this.escalationTimers.delete(alert.id);
    }, escalationRule.escalateAfter * 60 * 1000);

    this.escalationTimers.set(alert.id, timer);
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSlackColor(severity: string): string {
    const colors = {
      critical: '#ff0000',
      high: '#ff8c00',
      medium: '#ffd700',
      low: '#32cd32'
    };
    return colors[severity as keyof typeof colors] || colors.medium;
  }

  private mapToPagerDutySeverity(severity: string): string {
    const mapping = {
      critical: 'critical',
      high: 'error',
      medium: 'warning',
      low: 'info'
    };
    return mapping[severity as keyof typeof mapping] || 'warning';
  }

  private generateEmailTemplate(alert: Alert): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
          .alert { border-left: 4px solid #ff6b6b; padding: 15px; background: #f8f9fa; }
          .alert.critical { border-left-color: #ff0000; }
          .alert.high { border-left-color: #ff8c00; }
          .alert.medium { border-left-color: #ffd700; }
          .alert.low { border-left-color: #32cd32; }
          .header { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .metadata { margin-top: 15px; padding: 10px; background: #e9ecef; border-radius: 4px; }
          .timestamp { color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="alert ${alert.severity}">
          <div class="header">${alert.name}</div>
          <div class="message">${alert.message}</div>
          <div class="timestamp">Time: ${alert.timestamp.toISOString()}</div>
          <div class="timestamp">Severity: ${alert.severity.toUpperCase()}</div>
          ${alert.metadata ? `
            <div class="metadata">
              <strong>Additional Information:</strong>
              <pre>${JSON.stringify(alert.metadata, null, 2)}</pre>
            </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  // Query methods
  getAlerts(options: {
    severity?: string;
    resolved?: boolean;
    startTime?: Date;
    endTime?: Date;
    limit?: number;
  } = {}): Alert[] {
    let filtered = this.alertHistory;

    if (options.severity) {
      filtered = filtered.filter(alert => alert.severity === options.severity);
    }

    if (options.resolved !== undefined) {
      filtered = filtered.filter(alert => Boolean(alert.resolved) === options.resolved);
    }

    if (options.startTime) {
      filtered = filtered.filter(alert => alert.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      filtered = filtered.filter(alert => alert.timestamp <= options.endTime!);
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return options.limit ? filtered.slice(0, options.limit) : filtered;
  }

  getAlertStats(): {
    total: number;
    bySeverity: Record<string, number>;
    resolved: number;
    unresolved: number;
  } {
    const bySeverity: Record<string, number> = {};
    let resolved = 0;
    let unresolved = 0;

    for (const alert of this.alertHistory) {
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      if (alert.resolved) {
        resolved++;
      } else {
        unresolved++;
      }
    }

    return {
      total: this.alertHistory.length,
      bySeverity,
      resolved,
      unresolved
    };
  }
}