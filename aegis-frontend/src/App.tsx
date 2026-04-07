import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layout/MainLayout";

import Dashboard from "./pages/Dashboard";
import Alerts from "./pages/Alerts";
import Analytics from "./pages/Analytics";
import Cases from "./pages/Cases";
import LiveMap from "./pages/LiveMap";
import Settings from "./pages/Settings";

import { AlertProvider } from "./context/AlertContext";
import { CaseProvider }  from "./context/CaseContext";

function App() {
  return (
    <CaseProvider>
      <AlertProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<MainLayout />}>
              <Route path="/"          element={<Dashboard />} />
              <Route path="/alerts"    element={<Alerts />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/cases"     element={<Cases />} />
              <Route path="/livemap"   element={<LiveMap />} />
              <Route path="/settings"  element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AlertProvider>
    </CaseProvider>
  );
}

export default App;