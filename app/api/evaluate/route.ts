import { NextRequest, NextResponse } from 'next/server';
import * as ld from '@launchdarkly/node-server-sdk';

const LD_SDK_KEY = process.env.LD_SDK_KEY || '';

let client: ld.LDClient | null = null;

async function getClient(): Promise<ld.LDClient> {
  if (client) return client;
  client = ld.init(LD_SDK_KEY);
  await client.waitForInitialization({ timeout: 10 });
  return client;
}

export async function POST(req: NextRequest) {
  if (!LD_SDK_KEY) {
    return NextResponse.json({ error: 'LD_SDK_KEY not configured' }, { status: 500 });
  }

  try {
    const ldClient = await getClient();
    const { users } = await req.json() as {
      users: Array<{
        key: string;
        firstName: string;
        lastName: string;
        customerType: string;
        country: string;
        email: string;
      }>;
    };

    const results = await Promise.all(
      users.map(async (user) => {
        const context: ld.LDContext = {
          kind: 'user',
          key: user.key,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          custom: {
            customer_type: user.customerType,
            country: user.country,
          },
        };

        const [pricingLayout, segmentOffer] = await Promise.all([
          ldClient.variation('pricing-page-layout', context, 'control'),
          ldClient.variation('tealium-segment-offer', context, 'no-offer'),
        ]);

        return {
          key: user.key,
          name: `${user.firstName} ${user.lastName}`,
          pricingLayout,
          segmentOffer,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
