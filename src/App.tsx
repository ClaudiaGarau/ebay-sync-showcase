import { ThemeProvider } from "next-themes";
import { HashRouter, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import AiAssistant from "./pages/AiAssistant";
import Analytics from "./pages/Analytics";
import Automation from "./pages/Automation";
import AutomationWizard from "./pages/AutomationWizard";
import Dashboard from "./pages/Dashboard";
import DesignSystem from "./pages/DesignSystem";
import Import from "./pages/Import";
import Marketplaces from "./pages/Marketplaces";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Settings from "./pages/Settings";
import Suppliers from "./pages/Suppliers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider delayDuration={200}>
        <HashRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/import" element={<Import />} />
              <Route path="/automation" element={<Automation />} />
              <Route path="/automation/new" element={<AutomationWizard />} />
              <Route path="/automation/:id" element={<AutomationWizard />} />
              <Route path="/ai-assistant" element={<AiAssistant />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/suppliers" element={<Suppliers />} />
              <Route path="/marketplaces" element={<Marketplaces />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/design-system" element={<DesignSystem />} />
            </Route>
          </Routes>
        </HashRouter>
        <Toaster position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
