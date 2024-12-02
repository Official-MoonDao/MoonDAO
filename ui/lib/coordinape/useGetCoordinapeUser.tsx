import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { CoordinapeUser } from "@/lib/coordinape";

interface UseGetUserReturn {
  coordinapeId: CoordinapeUser | null;
  loading: boolean;
  authenticated: boolean;
  error: string | null;
}

export function useGetCoordinapeUser(): UseGetUserReturn {
  const { user, authenticated } = usePrivy();
  const [coordinapeId, setCoordinapeId] = useState<CoordinapeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.wallet?.address && authenticated) {
      fetch(`/api/coordinape/getUser?address=${user.wallet.address}`)
        .then(res => res.json())
        .then(data => {
          if (data.error) {
            setError(data.error);
            console.log(data);
          }
          setCoordinapeId(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setError(err.message || 'Failed to fetch user data');
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [authenticated, user?.wallet?.address]);

  return {
    coordinapeId,
    loading,
    authenticated,
    error
  };
}
