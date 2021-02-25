import { useState, useEffect, useRef } from "react";
import _ from "lodash";
const mapboxgl = require("mapbox-gl/dist/mapbox-gl.js");

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const fetcher = (url) =>
  fetch(url).then((res) => {
    res.json();
  });

function getFeatures(data, geoid) {
  return _.filter(data, { GEOID: geoid });
}

export default function Map({ center, location, changeLocation, entries }) {
  let dataRef = useRef(null);

  let geoIds = useRef(null);

  let ref = useRef(null);

  const [clicked, setClicked] = useState(false);

  // set up map and load data
  useEffect(() => {
    // initialize map and set map effects
    ref.current = new mapboxgl.Map({
      container: "my-map",
      style: "mapbox://styles/borauyumazturk/ckl4pn50n3lqa17o78ubsy0d0",
      center: [center.long, center.lat],
      zoom: center.zoom,
      attributionControl: false,
    });

    let map = ref.current;

    map.on("load", function () {
      fetch("/api/boundaries")
        .then((res) => res.json())
        .then((geojson) => {
          let result = geojson.data;
          result.features = result.features.map((x) => {
            x.properties.IDENTIFIER = x.properties.NAME.toLowerCase();
            return x;
          });
          console.log(result);
          return result;
        })
        .then((geojson) => {
          map.addSource("mapbox-boundary", {
            type: "geojson",
            data: geojson,
          });

          var layers = map.getStyle().layers;
          // Find the index of the first symbol layer in the map style
          // so that we can overlay other layers on top of it.
          var firstSymbolId;
          for (var i = 0; i < layers.length; i++) {
            if (layers[i].type === "symbol") {
              firstSymbolId = layers[i].id;
              break;
            }
          }

          // base availability layer
          map.addLayer(
            {
              id: "boundary-data",
              type: "fill",
              source: "mapbox-boundary",
              paint: {
                "fill-color": {
                  property: "status",
                  type: "categorical",
                  stops: [
                    ["Fully Booked", "#ed3b53"],
                    ["Available", "#3ce862"],
                  ],
                },
                "fill-opacity": 1.0,
                "fill-outline-color": "#0a0a0a",
              },
            },
            firstSymbolId
          );
          // location highlight layer
          map.addLayer(
            {
              id: "mouse-highlight",
              type: "line",
              source: "mapbox-boundary",
              paint: {
                "line-width": 2,
              },
              // don't highlight anything at first
              filter: false,
            },
            firstSymbolId
          );
          // location highlight layer
          map.addLayer(
            {
              id: "location-highlight",
              type: "line",
              source: "mapbox-boundary",
              paint: {
                "line-color": "#f2ec2e",
                "line-width": 2,
              },
              // don't highlight anything at first
              filter: false,
            },
            firstSymbolId
          );
        });
    });

    map.on("click", function (e) {
      var features = map.queryRenderedFeatures(e.point, {
        layers: ["boundary-data"],
      });

      if (features.length > 0) {
        setClicked(true);
        changeLocation(features[0].properties.identifier);
      }
    });

    map.on("mousemove", function (e) {
      var features = map.queryRenderedFeatures(e.point, {
        layers: ["boundary-data"],
      });

      if (features.length > 0) {
        var identifier = features[0].properties.identifier;
        console.log(identifier);
        map.setFilter("mouse-highlight", ["in", "identifier", identifier]);
      } else {
        map.setFilter("mouse-highlight", false);
      }
    });

    // fetch gazetteer data
    const setData = async () => {
      dataRef.current = await fetch("/api/gazetteer").then((res) => res.json());

      dataRef.current = dataRef.current.data;
    };
    setData();

    // initialize location -> geoId map
    const setGeoIds = async () => {
      const data = await fetch("/api/boundaries").then((res) => res.json());
      geoIds.current = data.data.features
        .map((x) => x.properties)
        .reduce((acc, val) => {
          // acc[val.NAME.toLowerCase()] = val.GEOID;
          acc[val.identifier] = val.GEOID;
          return acc;
        }, {});
    };
    setGeoIds();
  }, []);

  // add changing of coordinates on location change
  useEffect(() => {
    if (dataRef.current && geoIds.current && geoIds.current[location]) {
      const feat = getFeatures(dataRef.current, geoIds.current[location])[0];

      if (!clicked) {
        ref.current.flyTo({
          center: [parseFloat(feat.INTPTLONG), parseFloat(feat.INTPTLAT)],
          zoom: center.zoom,
        });
      }

      ref.current.setFilter("location-highlight", [
        "==",
        "identifier",
        location,
      ]);
    }

    setClicked(false);
  }, [location, clicked]);

  return <div id="my-map" className="relative h-full w-2/4" />;
}
