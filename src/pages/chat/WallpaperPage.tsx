import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Upload, Crop } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { wallpaperStorage } from '@/lib/wallpaperStorage';
import { toast } from 'sonner';
import ReactCrop, { Crop as CropType } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import aiChatWallpaper from '@/assets/ai-chat-wallpaper.webp';
import abstractPurpleBlue from '@/assets/wallpapers/abstract-purple-blue.webp';
import pastelDreams from '@/assets/wallpapers/pastel-dreams.webp';
import darkLuxury from '@/assets/wallpapers/dark-luxury.webp';
import tropicalSunset from '@/assets/wallpapers/tropical-sunset.webp';
import mintFresh from '@/assets/wallpapers/mint-fresh.webp';
import cosmicNebula from '@/assets/wallpapers/cosmic-nebula.webp';
import autumnWarmth from '@/assets/wallpapers/autumn-warmth.webp';
import neonVibes from '@/assets/wallpapers/neon-vibes.webp';
import cherryBlossom from '@/assets/wallpapers/cherry-blossom.webp';
import mountainMajesty from '@/assets/wallpapers/mountain-majesty.webp';
import oceanWaves from '@/assets/wallpapers/ocean-waves.webp';
import desertDunes from '@/assets/wallpapers/desert-dunes.webp';
import northernLights from '@/assets/wallpapers/northern-lights.webp';
import liquidGold from '@/assets/wallpapers/liquid-gold.webp';
import geometricDreams from '@/assets/wallpapers/geometric-dreams.webp';
import marbleElegance from '@/assets/wallpapers/marble-elegance.webp';
import watercolorSplash from '@/assets/wallpapers/watercolor-splash.webp';
import smokeArt from '@/assets/wallpapers/smoke-art.webp';
import galaxySpiral from '@/assets/wallpapers/galaxy-spiral.webp';
import planetRise from '@/assets/wallpapers/planet-rise.webp';
import starryNight from '@/assets/wallpapers/starry-night.webp';
import nebulaCloud from '@/assets/wallpapers/nebula-cloud.webp';
import cityLights from '@/assets/wallpapers/city-lights.webp';
import neonStreets from '@/assets/wallpapers/neon-streets.webp';
import glassReflection from '@/assets/wallpapers/glass-reflection.webp';
import skylineSunset from '@/assets/wallpapers/skyline-sunset.webp';
import roseGoldTexture from '@/assets/wallpapers/rose-gold-texture.webp';
import woodGrain from '@/assets/wallpapers/wood-grain.webp';
import fabricTexture from '@/assets/wallpapers/fabric-texture.webp';
import paperWaves from '@/assets/wallpapers/paper-waves.webp';
import lavenderField from '@/assets/wallpapers/lavender-field.webp';
import tropicalBeach from '@/assets/wallpapers/tropical-beach.webp';
import enchantedForest from '@/assets/wallpapers/enchanted-forest.webp';
import autumnLeaves from '@/assets/wallpapers/autumn-leaves.webp';
import waterfall from '@/assets/wallpapers/waterfall.webp';
import paintSplash from '@/assets/wallpapers/paint-splash.webp';
import holographic from '@/assets/wallpapers/holographic.webp';
import crystalGeode from '@/assets/wallpapers/crystal-geode.webp';
import zenGarden from '@/assets/wallpapers/zen-garden.webp';
import comet from '@/assets/wallpapers/comet.webp';
import astronautSpace from '@/assets/wallpapers/astronaut-space.webp';
import futureCity from '@/assets/wallpapers/future-city.webp';
import hotAirBalloons from '@/assets/wallpapers/hot-air-balloons.webp';
import japaneseTemple from '@/assets/wallpapers/japanese-temple.webp';
import bioluminescentWaves from '@/assets/wallpapers/bioluminescent-waves.webp';
import whatsappDoodle from '@/assets/wallpapers/whatsapp-doodle.webp';

const predefinedWallpapers = [
  // Static Wallpapers
  { id: 'default', name: 'Default', preview: whatsappDoodle },
  { id: 'cherry-blossom', name: 'Cherry Blossom', preview: cherryBlossom },
  { id: 'mountain-majesty', name: 'Mountain Majesty', preview: mountainMajesty },
  { id: 'ocean-waves', name: 'Ocean Waves', preview: oceanWaves },
  { id: 'desert-dunes', name: 'Desert Dunes', preview: desertDunes },
  { id: 'northern-lights', name: 'Northern Lights', preview: northernLights },
  { id: 'liquid-gold', name: 'Liquid Gold', preview: liquidGold },
  { id: 'geometric-dreams', name: 'Geometric Dreams', preview: geometricDreams },
  { id: 'marble-elegance', name: 'Marble Elegance', preview: marbleElegance },
  { id: 'watercolor-splash', name: 'Watercolor Splash', preview: watercolorSplash },
  { id: 'smoke-art', name: 'Smoke Art', preview: smokeArt },
  { id: 'galaxy-spiral', name: 'Galaxy Spiral', preview: galaxySpiral },
  { id: 'planet-rise', name: 'Planet Rise', preview: planetRise },
  { id: 'starry-night', name: 'Starry Night', preview: starryNight },
  { id: 'nebula-cloud', name: 'Nebula Cloud', preview: nebulaCloud },
  { id: 'city-lights', name: 'City Lights', preview: cityLights },
  { id: 'neon-streets', name: 'Neon Streets', preview: neonStreets },
  { id: 'glass-reflection', name: 'Glass Reflection', preview: glassReflection },
  { id: 'skyline-sunset', name: 'Skyline Sunset', preview: skylineSunset },
  { id: 'rose-gold-texture', name: 'Rose Gold', preview: roseGoldTexture },
  { id: 'wood-grain', name: 'Wood Grain', preview: woodGrain },
  { id: 'fabric-texture', name: 'Fabric Texture', preview: fabricTexture },
  { id: 'paper-waves', name: 'Paper Waves', preview: paperWaves },
  { id: 'lavender-field', name: 'Lavender Field', preview: lavenderField },
  { id: 'tropical-beach', name: 'Tropical Beach', preview: tropicalBeach },
  { id: 'enchanted-forest', name: 'Enchanted Forest', preview: enchantedForest },
  { id: 'autumn-leaves', name: 'Autumn Leaves', preview: autumnLeaves },
  { id: 'waterfall', name: 'Waterfall', preview: waterfall },
  { id: 'paint-splash', name: 'Paint Splash', preview: paintSplash },
  { id: 'holographic', name: 'Holographic', preview: holographic },
  { id: 'crystal-geode', name: 'Crystal Geode', preview: crystalGeode },
  { id: 'zen-garden', name: 'Zen Garden', preview: zenGarden },
  { id: 'comet', name: 'Comet', preview: comet },
  { id: 'astronaut-space', name: 'Astronaut Space', preview: astronautSpace },
  { id: 'future-city', name: 'Future City', preview: futureCity },
  { id: 'hot-air-balloons', name: 'Hot Air Balloons', preview: hotAirBalloons },
  { id: 'japanese-temple', name: 'Japanese Temple', preview: japaneseTemple },
  { id: 'bioluminescent-waves', name: 'Bioluminescent Waves', preview: bioluminescentWaves },
  { id: 'abstract-purple', name: 'Abstract Wave', preview: abstractPurpleBlue },
  { id: 'pastel', name: 'Pastel Dreams', preview: pastelDreams },
  { id: 'luxury', name: 'Dark Luxury', preview: darkLuxury },
  { id: 'tropical', name: 'Tropical Sunset', preview: tropicalSunset },
  { id: 'mint', name: 'Mint Fresh', preview: mintFresh },
  { id: 'cosmic', name: 'Cosmic Nebula', preview: cosmicNebula },
  { id: 'autumn', name: 'Autumn Warmth', preview: autumnWarmth },
  { id: 'neon', name: 'Neon Vibes', preview: neonVibes },
  { id: 'dark', name: 'Dark', color: '#0d1418' },
  { id: 'blue', name: 'Ocean Blue', color: '#1e3a5f' },
  { id: 'purple', name: 'Purple', color: '#4a1a4a' },
  { id: 'green', name: 'Forest Green', color: '#1a4d2e' },
  { id: 'burgundy', name: 'Burgundy', color: '#6b1e3f' },
  { id: 'teal', name: 'Teal', color: '#0f4d5c' },
  { id: 'charcoal', name: 'Charcoal', color: '#2c3e50' },
  { id: 'navy', name: 'Navy', color: '#1a2332' },
  { id: 'gradient1', name: 'Sunset', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'gradient2', name: 'Ocean', gradient: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)' },
  { id: 'gradient3', name: 'Fire', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'gradient4', name: 'Forest', gradient: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)' },
  { id: 'gradient5', name: 'Lavender', gradient: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
  { id: 'gradient6', name: 'Coral', gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)' },
  { id: 'gradient7', name: 'Golden', gradient: 'linear-gradient(135deg, #f2994a 0%, #f2c94c 100%)' },
  { id: 'gradient8', name: 'Northern', gradient: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)' },
];

export default function WallpaperPage() {
  const navigate = useNavigate();
  const [currentWallpaper, setCurrentWallpaper] = useState(() => {
    const saved = wallpaperStorage.loadWallpaper();
    return saved?.type === 'predefined' ? saved.value : 'default';
  });
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState<CropType>({
    unit: '%',
    width: 100,
    height: 100,
    x: 0,
    y: 0
  });
  const [completedCrop, setCompletedCrop] = useState<CropType | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleWallpaperSelect = (wallpaperId: string) => {
    wallpaperStorage.saveWallpaper({
      type: 'predefined',
      value: wallpaperId
    });
    setCurrentWallpaper(wallpaperId);
    toast.success('Wallpaper changed');
    setTimeout(() => navigate('/ai-assistant'), 300);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setCustomImage(reader.result as string);
          setIsCropping(true);
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Please select an image file');
      }
    }
  };

  const handleCropComplete = () => {
    if (!imageRef.current || !completedCrop) return;

    const canvas = document.createElement('canvas');
    const scaleX = imageRef.current.naturalWidth / imageRef.current.width;
    const scaleY = imageRef.current.naturalHeight / imageRef.current.height;
    
    canvas.width = completedCrop.width! * scaleX;
    canvas.height = completedCrop.height! * scaleY;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      imageRef.current,
      completedCrop.x! * scaleX,
      completedCrop.y! * scaleY,
      completedCrop.width! * scaleX,
      completedCrop.height! * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        wallpaperStorage.saveWallpaper({
          type: 'custom',
          value: base64
        });
        toast.success('Custom wallpaper applied');
        setIsCropping(false);
        setCustomImage(null);
        navigate('/ai-assistant');
      };
      reader.readAsDataURL(blob);
    }, 'image/jpeg', 0.9);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#075E54] shadow-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/ai-assistant')}
            className="shrink-0 text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="font-semibold text-white text-lg">Change Wallpaper</h1>
        </div>
      </div>

      {isCropping && customImage ? (
        // Crop View
        <div className="flex-1 flex flex-col p-4">
          <div className="flex-1 flex items-center justify-center bg-black/5 rounded-lg overflow-hidden mb-4">
            <ReactCrop
              crop={crop}
              onChange={c => setCrop(c)}
              onComplete={c => setCompletedCrop(c)}
              aspect={9 / 16}
            >
              <img
                ref={imageRef}
                src={customImage}
                alt="Crop preview"
                className="max-w-full max-h-[60vh] object-contain"
              />
            </ReactCrop>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setIsCropping(false);
                setCustomImage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#25D366] hover:bg-[#20BA5A]"
              onClick={handleCropComplete}
            >
              <Check className="mr-2 h-4 w-4" />
              Apply Wallpaper
            </Button>
          </div>
        </div>
      ) : (
        // Wallpaper Selection View
        <>
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {/* Custom Upload Section */}
              <div>
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground">Custom Wallpaper</h2>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  className="w-full h-32 border-2 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm">Upload from Gallery</span>
                    <span className="text-xs text-muted-foreground">Tap to select image</span>
                  </div>
                </Button>
              </div>

              {/* Predefined Wallpapers */}
              <div>
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground">Preset Wallpapers</h2>
                <div className="grid grid-cols-3 gap-3">
                  {predefinedWallpapers.map((wallpaper) => (
                    <button
                      key={wallpaper.id}
                      onClick={() => handleWallpaperSelect(wallpaper.id)}
                      className="relative aspect-[9/16] rounded-lg overflow-hidden border-2 transition-all hover:scale-105"
                      style={{
                        background: wallpaper.preview 
                          ? `url(${wallpaper.preview}) center/cover` 
                          : wallpaper.gradient || wallpaper.color,
                        borderColor: currentWallpaper === wallpaper.id ? 'hsl(var(--primary))' : 'hsl(var(--border))'
                      }}
                    >
                      {currentWallpaper === wallpaper.id && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-10">
                          <div className="bg-white rounded-full p-1.5">
                            <Check className="h-5 w-5 text-green-600" />
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-2 text-center z-10">
                        {wallpaper.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}
