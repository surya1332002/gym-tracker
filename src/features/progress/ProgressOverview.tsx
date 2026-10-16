import { Link } from 'react-router-dom'
import './progress.css'
export default function ProgressOverview() {
  return <section><h1>Progress</h1><p>Explore your actual training and body changes.</p><div className="analytics-grid"><Link className="workout-choice" to="/progress/strength"><strong>Strength</strong><span>Exercise trends, personal records and completed-set volume</span></Link><Link className="workout-choice" to="/progress/body"><strong>Body</strong><span>Weight, measurements and dated trends</span></Link><Link className="workout-choice" to="/progress/photos"><strong>Photos</strong><span>Private progress check-ins</span></Link></div><div className="analytics-actions"><Link to="/progress/calendar">Activity calendar</Link><Link to="/workout/history">Workout history</Link></div></section>
}
