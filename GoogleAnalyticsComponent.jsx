import { useEffect } from "react";
import { initGA, logPageView } from "./googleAnalytics";

const GoogleAnalyticsComponent = () => {
  useEffect(() => {
    initGA(); // Initialize GA
    logPageView(window.location.pathname); // Page view track
  }, []);

  return <div>Analytics initialized</div>;
};

export default GoogleAnalyticsComponent;
