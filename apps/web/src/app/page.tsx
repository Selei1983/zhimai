import { AuthShell } from "@/components/auth-shell";
import { getZhimaiInitialData } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getZhimaiInitialData();

  return <AuthShell initialData={data} />;
}
