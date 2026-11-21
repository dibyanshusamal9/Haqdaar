import { redirect } from "next/navigation";

// The example profiles now live at /stories ("Success Stories").
export default function ExamplesPage() {
  redirect("/stories");
}
