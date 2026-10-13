import React, { useState } from 'react';
import './StarRating.css';

const StarRating = ({ score = 0, onChange, max = 4 }) => {
    const [hover, setHover] = useState(0);

    const stars = Array.from({ length: max }, (_, i) => i + 1);

    return (
        <div className="star-rating">
            {stars.map(star => (
                <span
                    key={star}
                    className={(star <= (hover || score) ? 'star filled' : 'star')}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => onChange(star)}
                >
                    &#9733;
                </span>
            ))}
        </div>
    );
};

export default StarRating;
