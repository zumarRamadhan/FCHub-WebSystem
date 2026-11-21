import { redirect } from "next/navigation";

export default function OwnerIndexPage({
  searchParams,
}: {
  searchParams?: { project?: string };
}) {
  const query = searchParams?.project ? `?project=${searchParams.project}` : "";
  redirect(`/owner/dashboard${query}`);
}
