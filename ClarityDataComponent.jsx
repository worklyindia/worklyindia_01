import { useEffect, useState } from "react";

export default function ClarityDataComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/clarity-data")  // Node.js / Express endpoint
      .then(res => res.json())
      .then(data => setData(data))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <h2>Clarity Data</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
