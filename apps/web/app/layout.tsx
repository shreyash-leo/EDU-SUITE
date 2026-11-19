import { NavigationProvider } from "../lib/navigation";
import "./style.css";
import "./enterprise.css";
import "./density.css";
import "./design-tokens.css";
import "./platform.css";
import "./reference-theme.css";
export const metadata = {
  title: "PLAN EDU SUITE",
  description: "Academic operations, thoughtfully connected.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavigationProvider>{children}</NavigationProvider>
      </body>
    </html>
  );
}
