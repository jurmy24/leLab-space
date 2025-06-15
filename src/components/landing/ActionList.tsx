
import React from 'react';
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Action } from './types';

interface ActionListProps {
  actions: Action[];
  robotModel: string;
}

const ActionList: React.FC<ActionListProps> = ({ actions, robotModel }) => {
  const isLeKiwi = robotModel === "LeKiwi";
  const isDisabled = !robotModel || isLeKiwi;

  return (
    <div className="pt-6">
      {!robotModel && (
        <p className="text-center text-gray-400 mb-4">
          Please select a robot model to continue.
        </p>
      )}
      {isLeKiwi && (
        <p className="text-center text-yellow-500 mb-4">
          LeKiwi model is not yet supported. Please select another model to continue.
        </p>
      )}
      <div className="space-y-4">
        {actions.map((action, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700 transition-opacity ${
              isDisabled ? "opacity-50" : ""
            }`}
          >
            <div>
              <h3 className="font-semibold text-lg">{action.title}</h3>
              <p className="text-gray-400 text-sm">
                {action.description}
              </p>
            </div>
            <Button
              onClick={action.handler}
              size="icon"
              className={`${action.color} text-white`}
              disabled={isDisabled}
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActionList;
