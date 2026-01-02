import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { JSX, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

export default function AuthGuard({
  children,
}: {
  children: JSX.Element;
}) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<boolean>(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(!!u);
      setLoading(false);
    });
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!user) return <Navigate to="/" replace />;

  return children;
}
