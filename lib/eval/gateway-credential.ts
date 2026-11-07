type GatewayEnv = Readonly<Record<string, string | undefined>>;

export function hasGatewayCredential(env: GatewayEnv): boolean {
  return Boolean(env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN);
}
