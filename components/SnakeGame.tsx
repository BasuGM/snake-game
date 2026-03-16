"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Howl } from "howler";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";

const GRID_SIZE = 20;
const INITIAL_SPEED = 100;

interface Position {
  x: number;
  y: number;
}

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

export default function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const [food, setFood] = useState<Position>({ x: 15, y: 15 });
  const [direction, setDirection] = useState<Direction>("RIGHT");
  const [nextDirection, setNextDirection] = useState<Direction>("RIGHT");
  const [score, setScore] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [highScores, setHighScores] = useState<Record<string, number>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const eatSoundRef = useRef<Howl | null>(null);
  const gameOverSoundRef = useRef<Howl | null>(null);

  const generateFood = useCallback((): Position => {
    return {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE),
    };
  }, []);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const savedHighScores = localStorage.getItem("snake-high-scores");
    if (savedHighScores) {
      try {
        setHighScores(JSON.parse(savedHighScores));
      } catch (e) {
        console.error("Failed to load high scores", e);
      }
    }

    const savedSoundEnabled = localStorage.getItem("snake-sound-enabled");
    if (savedSoundEnabled !== null) {
      setSoundEnabled(JSON.parse(savedSoundEnabled));
    }
  }, []);

  useEffect(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Create eat sound (higher pitch beep)
    const createEatSound = () => {
      const now = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.frequency.setValueAtTime(800, now);
      osc.frequency.setValueAtTime(1000, now + 0.05);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

      osc.start(now);
      osc.stop(now + 0.1);
    };

    // Create game over sound (descending beeps)
    const createGameOverSound = () => {
      const now = audioContext.currentTime;
      for (let i = 0; i < 3; i++) {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();

        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.frequency.setValueAtTime(400 - i * 100, now + i * 0.15);
        gain.gain.setValueAtTime(0.3, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.15);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.15);
      }
    };

    eatSoundRef.current = {
      play: createEatSound,
    } as any;

    gameOverSoundRef.current = {
      play: createGameOverSound,
    } as any;
  }, []);

  const playSound = (soundRef: React.MutableRefObject<Howl | null>) => {
    if (soundEnabled && soundRef.current) {
      try {
        soundRef.current.play();
      } catch (e) {
        console.error("Error playing sound", e);
      }
    }
  };

  const toggleSound = () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabled(newSoundEnabled);
    localStorage.setItem("snake-sound-enabled", JSON.stringify(newSoundEnabled));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellSize = canvas.width / GRID_SIZE;

    // Dark mode colors
    const bgColor = isDarkMode ? "#1a1a1a" : "#f5f5f5";
    const gridColor = isDarkMode ? "#333333" : "#e0e0e0";
    const snakeHeadColor = "#22c55e";
    const snakeBodyColor = isDarkMode ? "#10b981" : "#86efac";
    const foodColor = "#ef4444";

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cellSize, 0);
      ctx.lineTo(i * cellSize, canvas.width);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i * cellSize);
      ctx.lineTo(canvas.width, i * cellSize);
      ctx.stroke();
    }

    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? snakeHeadColor : snakeBodyColor;
      ctx.fillRect(
        segment.x * cellSize + 1,
        segment.y * cellSize + 1,
        cellSize - 2,
        cellSize - 2
      );

      if (index === 0) {
        ctx.fillStyle = isDarkMode ? "#000000" : "#ffffff";
        const eyeSize = cellSize / 6;
        let eyeX1, eyeY1, eyeX2, eyeY2;

        if (direction === "RIGHT") {
          eyeX1 = segment.x * cellSize + cellSize * 0.7;
          eyeY1 = segment.y * cellSize + cellSize * 0.35;
          eyeX2 = segment.x * cellSize + cellSize * 0.7;
          eyeY2 = segment.y * cellSize + cellSize * 0.65;
        } else if (direction === "LEFT") {
          eyeX1 = segment.x * cellSize + cellSize * 0.3;
          eyeY1 = segment.y * cellSize + cellSize * 0.35;
          eyeX2 = segment.x * cellSize + cellSize * 0.3;
          eyeY2 = segment.y * cellSize + cellSize * 0.65;
        } else if (direction === "DOWN") {
          eyeX1 = segment.x * cellSize + cellSize * 0.35;
          eyeY1 = segment.y * cellSize + cellSize * 0.7;
          eyeX2 = segment.x * cellSize + cellSize * 0.65;
          eyeY2 = segment.y * cellSize + cellSize * 0.7;
        } else {
          eyeX1 = segment.x * cellSize + cellSize * 0.35;
          eyeY1 = segment.y * cellSize + cellSize * 0.3;
          eyeX2 = segment.x * cellSize + cellSize * 0.65;
          eyeY2 = segment.y * cellSize + cellSize * 0.3;
        }

        ctx.beginPath();
        ctx.arc(eyeX1, eyeY1, eyeSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(eyeX2, eyeY2, eyeSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.fillStyle = foodColor;
    ctx.beginPath();
    ctx.arc(
      food.x * cellSize + cellSize / 2,
      food.y * cellSize + cellSize / 2,
      cellSize / 2 - 2,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }, [snake, food, direction, isDarkMode]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isFormControl = target.tagName === "INPUT" || 
                            target.tagName === "SELECT" || 
                            target.tagName === "TEXTAREA" ||
                            target.tagName === "BUTTON" ||
                            (target.getAttribute("role") === "combobox") ||
                            (target.getAttribute("role") === "listbox");

      // Only handle space key if no form control is focused
      if (e.key === " ") {
        if (isFormControl) return;
        
        setIsPlaying((prev) => !prev);
        e.preventDefault();
        return;
      }

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          if (direction !== "DOWN") setNextDirection("UP");
          e.preventDefault();
          break;
        case "ArrowDown":
        case "s":
        case "S":
          if (direction !== "UP") setNextDirection("DOWN");
          e.preventDefault();
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          if (direction !== "RIGHT") setNextDirection("LEFT");
          e.preventDefault();
          break;
        case "ArrowRight":
        case "d":
        case "D":
          if (direction !== "LEFT") setNextDirection("RIGHT");
          e.preventDefault();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [direction]);

  useEffect(() => {
    if (!isPlaying || gameOver) {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      return;
    }

    gameLoopRef.current = setInterval(() => {
      setSnake((prevSnake) => {
        setDirection(nextDirection);
        const head = prevSnake[0];
        let newHead: Position = { ...head };

        switch (nextDirection) {
          case "UP":
            newHead.y = (head.y - 1 + GRID_SIZE) % GRID_SIZE;
            break;
          case "DOWN":
            newHead.y = (head.y + 1) % GRID_SIZE;
            break;
          case "LEFT":
            newHead.x = (head.x - 1 + GRID_SIZE) % GRID_SIZE;
            break;
          case "RIGHT":
            newHead.x = (head.x + 1) % GRID_SIZE;
            break;
        }

        if (
          prevSnake.some(
            (segment) => segment.x === newHead.x && segment.y === newHead.y
          )
        ) {
          setGameOver(true);
          setIsPlaying(false);
          playSound(gameOverSoundRef);
          return prevSnake;
        }

        let newSnake = [newHead, ...prevSnake];

        if (newHead.x === food.x && newHead.y === food.y) {
          setFood(generateFood());
          setScore((prev) => prev + 10);
          playSound(eatSoundRef);
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    }, speed);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [isPlaying, gameOver, speed, nextDirection, food, generateFood]);

  const resetGame = () => {
    setSnake([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
    setFood(generateFood());
    setDirection("RIGHT");
    setNextDirection("RIGHT");
    setScore(0);
    setGameOver(false);
    setIsPlaying(false);
    setSpeed(INITIAL_SPEED);
  };

  const getHighScore = (): number => {
    return highScores[speed.toString()] || 0;
  };

  const updateHighScore = () => {
    const speedKey = speed.toString();
    const currentHighScore = highScores[speedKey] || 0;
    
    if (score > currentHighScore) {
      const newHighScores = { ...highScores, [speedKey]: score };
      setHighScores(newHighScores);
      localStorage.setItem("snake-high-scores", JSON.stringify(newHighScores));
    }
  };

  useEffect(() => {
    if (gameOver) {
      updateHighScore();
    }
  }, [gameOver]);

  return (
    <div className="flex gap-8 items-center justify-center py-24 px-4">
      {/* Left Side - Game Canvas */}
      <div className="flex flex-col items-center">
        <canvas
          ref={canvasRef}
          width={400}
          height={400}
          className="border-2 border-border rounded-lg shadow-lg dark:bg-slate-950 bg-white"
        />
      </div>

      {/* Right Side - Controls and Info */}
      <div className="flex flex-col gap-6 w-64">
        <div className="flex flex-row gap-4 justify-around items-center text-center">
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">Score</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 bg-clip-text text-transparent">
              {score}
            </p>
          </div>
          <div className="h-12 w-px bg-border/50"></div>
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">High</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-500">
              {getHighScore()}
            </p>
          </div>
          <div className="h-12 w-px bg-border/50"></div>
          <div>
            <p className="text-xs text-muted-foreground tracking-widest uppercase mb-2">Speed</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {INITIAL_SPEED / speed}x
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {gameOver ? (
            <div className="rounded-lg bg-red-500/10 border-2 border-red-500 h-9 flex items-center justify-center animate-pulse">
              <p className="text-2xl font-bold text-red-600 dark:text-red-500">Game Over!</p>
            </div>
          ) : (
            <Button
              onClick={() => setIsPlaying(!isPlaying)}
              variant={isPlaying ? "secondary" : "default"}
              size="sm"
              className="w-full"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Play
                </>
              )}
            </Button>
          )}
          <Button onClick={resetGame} variant="outline" size="sm" className="w-full">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={toggleSound} variant="outline" size="sm" className="w-full">
            {soundEnabled ? (
              <>
                <Volume2 className="h-4 w-4 mr-2" />
                Sound On
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4 mr-2" />
                Sound Off
              </>
            )}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-semibold text-sm">Speed:</span>
          <Select value={speed.toString()} onValueChange={(value) => setSpeed(Number(value))} disabled={isPlaying || score > 0}>
            <SelectTrigger className="w-full" disabled={isPlaying || score > 0}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="200">Slow</SelectItem>
              <SelectItem value="100">Normal</SelectItem>
              <SelectItem value="50">Fast</SelectItem>
              <SelectItem value="25">Very Fast</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border-t pt-4">
          <p className="font-semibold text-sm mb-2">Controls:</p>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>↑ W - Move Up</p>
            <p>↓ S - Move Down</p>
            <p>← A - Move Left</p>
            <p>→ D - Move Right</p>
            <p>Space - Play/Pause</p>
          </div>
        </div>
      </div>
    </div>
  );
}
