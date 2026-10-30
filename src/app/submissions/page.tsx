import { redirect } from "next/navigation";

export default function SubmissionsPage() {
  redirect("/status?myself=1");
}
