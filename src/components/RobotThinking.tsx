import React from 'react';
import { motion } from 'framer-motion';
import RobotSVG from '../assets/robot.svg';  // Import your SVG

const RobotThinking: React.FC = () => {
  return (
    <motion.div
      className="flex flex-col items-center justify-center p-2 bg-gray-800 rounded-lg shadow-lg absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <motion.img
        src={RobotSVG}
        alt="Robot thinking"
        className="w-12 h-12 mb-2"
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 2,
          ease: "easeInOut",
          times: [0, 0.5, 1],
          repeat: Infinity,
        }}
      />
      <motion.div
        animate={{
          opacity: [0, 1, 0],
        }}
        transition={{
          duration: 1.5,
          ease: "easeInOut",
          times: [0, 0.5, 1],
          repeat: Infinity,
        }}
        className="text-white text-sm font-bold"
      >
        Thinking...
      </motion.div>
    </motion.div>
  );
};

export default RobotThinking;