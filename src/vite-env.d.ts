/// <reference types="vite/client" />

// Temporary Leaflet type declarations
declare module 'leaflet' {
  export class Map {
    constructor(element: string | HTMLElement, options?: any);
    setView(center: [number, number], zoom: number): this;
    on(event: string, fn: (e: any) => void): this;
    remove(): void;
    invalidateSize(): void;
    fitBounds(bounds: [[number, number], [number, number]], options?: any): this;
    eachLayer(fn: (layer: any) => void): this;
  }

  export class Marker {
    constructor(latlng: [number, number], options?: any);
    addTo(map: Map): this;
    bindPopup(content: string | HTMLElement, options?: any): this;
    setPopupContent(content: string | HTMLElement): this;
    openPopup(): this;
    remove(): void;
    setLatLng(latlng: [number, number]): this;
    getLatLng(): { lat: number; lng: number };
  }

  export class TileLayer {
    constructor(urlTemplate: string, options?: any);
    addTo(map: Map): this;
  }

  export class Polygon {
    constructor(latlngs: [number, number][] | [number, number][][], options?: any);
    addTo(map: Map): this;
    remove(): void;
    setStyle(style: any): this;
    getBounds(): any;
  }

  export class Circle {
    constructor(latlng: [number, number], options?: any);
    addTo(map: Map): this;
    remove(): void;
  }

  export interface LeafletMouseEvent {
    latlng: {
      lat: number;
      lng: number;
    };
    originalEvent: MouseEvent;
  }

  export function tileLayer(urlTemplate: string, options?: any): TileLayer;
  export function marker(latlng: [number, number], options?: any): Marker;
  export function polygon(latlngs: [number, number][] | [number, number][][], options?: any): Polygon;
  export function circle(latlng: [number, number], options?: any): Circle;
  export function icon(options: any): any;

  export const Icon: {
    Default: {
      prototype: any;
      mergeOptions(options: any): void;
    };
  };

  namespace L {
    export { Map, Marker, TileLayer, Polygon, Circle, LeafletMouseEvent };
  }

  const L: any;
  export default L;
}


