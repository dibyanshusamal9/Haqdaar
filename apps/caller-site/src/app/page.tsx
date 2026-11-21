import ScrollSequence from "@/features/home/ScrollSequence";
import HomeSections from "@/features/home/HomeSections";

export default function Home() {
  return (
    <main style={{ minHeight: "100vh", backgroundColor: "#1c1710" }}>
      <ScrollSequence />
      <HomeSections />
    </main>
  );
}
