import { WooCommerceService, WooCommerceConfig } from './woocommerce';

/**
 * WooCommerce Connection Pool
 * Manages reusable WooCommerce service instances to avoid recreating connections
 * FIXES: Amateur hour anti-pattern of creating new service instances in every method call
 */
class WooCommercePool {
  private connections = new Map<string, WooCommerceService>();
  
  private generateConnectionKey(config: WooCommerceConfig): string {
    return `${config.storeUrl}:${config.consumerKey}`;
  }
  
  getOrCreateService(config: WooCommerceConfig): WooCommerceService {
    const key = this.generateConnectionKey(config);
    
    if (!this.connections.has(key)) {
      this.connections.set(key, new WooCommerceService(config));
    }
    
    return this.connections.get(key)!;
  }
  
  clearConnection(config: WooCommerceConfig): void {
    const key = this.generateConnectionKey(config);
    this.connections.delete(key);
  }
  
  clearAllConnections(): void {
    this.connections.clear();
  }
  
  getActiveConnectionCount(): number {
    return this.connections.size;
  }
}

export const wooCommercePool = new WooCommercePool();