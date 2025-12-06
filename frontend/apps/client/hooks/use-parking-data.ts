import { getParkingStatus, getRoiConfig, RoiSpace } from "@repo/core";
import { useCallback, useEffect, useState } from "react";

export function useParkingData() {
  const [polygons, setPolygons] = useState<RoiSpace[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  // Navigation State
  const [facilities, setFacilities] = useState<string[]>([]);
  const [devicesByFacility, setDevicesByFacility] = useState<
    Record<string, string[]>
  >({});

  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Initial Data Load (Facilities & Devices)
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        console.log("Fetching global status...");
        const spaces = await getParkingStatus(); // Fetch all data

        if (!active) return;

        // Group by Facility -> Devices
        const facilityMap: Record<string, Set<string>> = {};
        const statusMap: Record<string, string> = {};

        spaces.forEach((space: any) => {
          if (space.space_id && space.status) {
            statusMap[space.space_id] = space.status;
          }

          const facId = space.facility_id || "facility-1"; // Default fallbacks
          const devId = space.device_id; // Assumes backend returns device_id

          if (facId && devId) {
            if (!facilityMap[facId]) facilityMap[facId] = new Set();
            facilityMap[facId].add(devId);
          }
        });

        const sortedFacilities = Object.keys(facilityMap).sort();
        const groupedDevices: Record<string, string[]> = {};

        sortedFacilities.forEach((f) => {
          groupedDevices[f] = Array.from(facilityMap[f]).sort();
        });

        console.log("Found facilities:", sortedFacilities);
        console.log("Device Map:", groupedDevices);

        if (sortedFacilities.length > 0) {
          setFacilities(sortedFacilities);
          setDevicesByFacility(groupedDevices);

          // Auto-select first facility & device
          if (!selectedFacility || !facilityMap[selectedFacility]) {
            const firstFac = sortedFacilities[0];
            setSelectedFacility(firstFac);

            // Select first device in that facility
            const firstDev = groupedDevices[firstFac]?.[0];
            if (firstDev) setSelectedDevice(firstDev);
          }

          setStatuses(statusMap);
        } else {
          setErrorMsg("No active facilities found. Check backend connection.");
        }
      } catch (err: any) {
        console.error("Init failed:", err);
        setErrorMsg(err.message || "Failed to load system.");
      } finally {
        if (active) setLoading(false);
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  // 2. Load ROI when Device Changes
  useEffect(() => {
    if (!selectedDevice) return;

    const loadRoi = async () => {
      try {
        setLoadingConfig(true);
        console.log(`Loading config for ${selectedDevice}...`);
        const spaces = await getRoiConfig(selectedDevice);
        setPolygons(spaces);
      } catch (e) {
        console.error("ROI Load failed", e);
        setPolygons([]);
      } finally {
        setLoadingConfig(false);
      }
    };

    loadRoi();
  }, [selectedDevice]);

  const handleFacilitySelect = useCallback(
    (fac: string) => {
      setSelectedFacility(fac);
      const devs = devicesByFacility[fac];
      if (devs && devs.length > 0) {
        setSelectedDevice(devs[0]); // Auto-select first camera
      } else {
        setSelectedDevice(null);
      }
    },
    [devicesByFacility]
  );

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return {
    facilities,
    devicesByFacility,
    selectedFacility,
    selectedDevice,
    setSelectedDevice,
    handleFacilitySelect,
    polygons,
    statuses,
    setStatuses,
    loading,
    loadingConfig,
    errorMsg,
    refresh,
  };
}
