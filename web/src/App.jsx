import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    fetch(`${API_URL}/api/message`)
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage("Cannot reach the API"));
  }, []);

  return (
    <div style={{ padding: 32, fontFamily: "Arial" }}>
      <h1>My Docker App</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;
