import { useEffect } from "react";
import { HousingDashboard } from "@/components/dashboard/HousingDashboard";

const Index = () => {
  // The map owns the scroll lock, and only while it is mounted. It used to be an
  // unconditional `overflow: hidden` on html/body in index.css, which meant the
  // methodology page rendered its full length inside a body that could not
  // scroll — the reader saw the first screen and nothing else.
  useEffect(() => {
    document.body.classList.add("app-scroll-locked");
    return () => document.body.classList.remove("app-scroll-locked");
  }, []);

  return <HousingDashboard />;
};

export default Index;
