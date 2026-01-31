import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import ServerManager from '@/components/ServerManager';

export default async function ServerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login?callbackUrl=/dashboard/servers');

  const { id } = await params;

  return <ServerManager serverId={id} />;
}
