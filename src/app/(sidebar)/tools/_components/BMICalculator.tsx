'use client'

import React, { useState, useEffect } from 'react'
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

interface BMIRange {
  range: string;
  classification: string;
  color: string;
}

const BMICalculator: React.FC = () => {
  // Initial state values
  const [weight, setWeight] = useState<number>(70)
  const [height, setHeight] = useState<number>(170)
  const [bmi, setBMI] = useState<number>(0)
  const [bmiStatus, setBMIStatus] = useState<BMIRange>({
    range: "",
    classification: "",
    color: ""
  })

  // BMI classification ranges
  const bmiRanges: BMIRange[] = [
    { range: "< 18.5", classification: "Underweight", color: "bg-blue-500" },
    { range: "18.5 - 24.9", classification: "Normal weight", color: "bg-green-500" },
    { range: "25 - 29.9", classification: "Overweight", color: "bg-yellow-500" },
    { range: "30 - 34.9", classification: "Obesity Class I", color: "bg-orange-500" },
    { range: "35 - 39.9", classification: "Obesity Class II", color: "bg-red-400" },
    { range: "> 40", classification: "Obesity Class III", color: "bg-red-600" }
  ]

  // Calculate BMI whenever weight or height changes
  useEffect(() => {
    calculateBMI()
  }, [weight, height])

  // Calculate BMI and determine status
  const calculateBMI = () => {
    const heightInMeters = height / 100
    const bmiValue = weight / (heightInMeters * heightInMeters)
    setBMI(parseFloat(bmiValue.toFixed(1)))
    
    // Set BMI status based on calculated value
    if (bmiValue < 18.5) {
      setBMIStatus(bmiRanges[0])
    } else if (bmiValue < 25) {
      setBMIStatus(bmiRanges[1])
    } else if (bmiValue < 30) {
      setBMIStatus(bmiRanges[2]) 
    } else if (bmiValue < 35) {
      setBMIStatus(bmiRanges[3])
    } else if (bmiValue < 40) {
      setBMIStatus(bmiRanges[4])
    } else {
      setBMIStatus(bmiRanges[5])
    }
  }

  return (
    <div className="space-y-6">
      {/* Weight slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="weight">Weight</Label>
          <span className="text-sm font-medium">{weight} kg</span>
        </div>
        <Slider 
          id="weight"
          min={30}
          max={200}
          step={1}
          value={[weight]}
          onValueChange={(value) => setWeight(value[0])}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>30 kg</span>
          <span>200 kg</span>
        </div>
      </div>

      {/* Height slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="height">Height</Label>
          <span className="text-sm font-medium">{height} cm</span>
        </div>
        <Slider 
          id="height"
          min={120}
          max={220}
          step={1}
          value={[height]}
          onValueChange={(value) => setHeight(value[0])}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>120 cm</span>
          <span>220 cm</span>
        </div>
      </div>

      {/* Result section */}
      <div className="pt-6 space-y-4">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">Your BMI</div>
          <div className="text-4xl font-bold">{bmi}</div>
          <Badge 
            className={`mt-2 ${bmiStatus.color} hover:${bmiStatus.color}`}
          >
            {bmiStatus.classification}
          </Badge>
        </div>

        {/* BMI scale visualization */}
        <div className="flex justify-between h-2 mt-8 mb-2">
          {bmiRanges.map((range, index) => (
            <div 
              key={index} 
              className={`h-full flex-1 ${range.color}`}
            ></div>
          ))}
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>18.5</span>
          <span>25</span>
          <span>30</span>
          <span>35</span>
          <span>40</span>
        </div>

        {/* Information alert */}
        <Alert className="mt-6 bg-muted/50">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription className="text-xs text-muted-foreground">
            BMI = weight (kg) / height (m)². BMI is a screening tool, not a diagnostic. 
            Please consult with a healthcare professional for a complete health assessment.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

export default BMICalculator