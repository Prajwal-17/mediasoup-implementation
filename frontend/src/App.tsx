import { BrowserRouter, Route, Routes } from "react-router-dom";
import Sender from "./components/Sender";
import Receiver from "./components/Receiver";
import CallComponent from "./components/CallComponent";

const App = () => {
  return (
    <>
      <div className="bg-red-500">Video Conferencing App</div>
      <BrowserRouter>
        <Routes>
          <Route path="/receiver" element={<Receiver />} />
          <Route path="/sender" element={<Sender />} />
          <Route path="/call" element={<CallComponent />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

export default App;
