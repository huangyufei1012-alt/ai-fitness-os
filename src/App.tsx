import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import Topbar from './components/layout/Topbar'
import { useAppState } from './lib/store'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import BodyScan from './pages/BodyScan'
import MuscleMap from './pages/MuscleMap'
import Progress from './pages/Progress'
import TrainingPlan from './pages/TrainingPlan'
import Workout from './pages/Workout'
import TrainingHistory, { TrainingHistoryDetail } from './pages/TrainingHistory'
import ExerciseLibrary from './pages/ExerciseLibrary'
import ExerciseDetail from './pages/ExerciseDetail'
import NutritionToday from './pages/NutritionToday'
import Meals from './pages/Meals'
import NutritionPlan from './pages/NutritionPlan'
import AICoach from './pages/AICoach'
import Settings from './pages/Settings'

function Shell() {
  const state = useAppState()
  if (!state.onboarded) {
    return <Routes><Route path="*" element={<Onboarding />} /></Routes>
  }
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/body/scan" element={<BodyScan />} />
            <Route path="/body/muscle-map" element={<MuscleMap />} />
            <Route path="/body/progress" element={<Progress />} />
            <Route path="/training/plan" element={<TrainingPlan />} />
            <Route path="/training/workout" element={<Workout />} />
            <Route path="/training/history" element={<TrainingHistory />} />
            <Route path="/training/history/:id" element={<TrainingHistoryDetail />} />
            <Route path="/training/library" element={<ExerciseLibrary />} />
            <Route path="/training/exercise/:id" element={<ExerciseDetail />} />
            <Route path="/nutrition/today" element={<NutritionToday />} />
            <Route path="/nutrition/meals" element={<Meals />} />
            <Route path="/nutrition/plan" element={<NutritionPlan />} />
            <Route path="/coach" element={<AICoach />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  )
}
