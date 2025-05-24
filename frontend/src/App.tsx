import { BrowserRouter, Route, Routes } from "react-router-dom";
import CallComponent from "./components/CallComponent";

const App = () => {
  return (
    <>
      <div className="bg-red-500">Video Conferencing App</div>
      <BrowserRouter>
        <Routes>
          <Route path="/call" element={<CallComponent />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;
