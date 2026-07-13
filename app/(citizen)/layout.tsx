import { Header } from "@/components/Header";

export default function CitizenLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="flex flex-1 flex-col pt-14 sm:pt-0">{children}</div>
    </>
  );
}
