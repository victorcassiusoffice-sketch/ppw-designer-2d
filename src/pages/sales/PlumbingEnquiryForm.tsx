import { PitchEnquiryForm } from '../pitch/PitchEnquiryForm';
import '../pitch/pitch.css';
import '../pitch/pitch-tactile.css';

/** The last chapter owns the form and its styles; earlier chapters need neither. */
export default function PlumbingEnquiryForm() {
  return <PitchEnquiryForm audience="merchants" />;
}
