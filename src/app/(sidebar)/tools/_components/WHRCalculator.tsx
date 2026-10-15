'use client'

import React, { useState, useEffect } from 'react'
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface WHRCategory {
  range: string;
  risk: string;
  color: string;
}

const WHRCalculator: React.FC = () => {
  // Initial state values
  const [waist, setWaist] = useState<number>(80)
  const [hip, setHip] = useState<number>(100)
  const [gender, setGender] = useState<string>("male")
  const [whr, setWHR] = useState<number>(0)
  const [riskCategory, setRiskCategory] = useState<WHRCategory>({
    range: "",
    risk: "",
    color: ""
  })

  // Risk categories by gender
  const maleCategories: WHRCategory[] = [
    { range: "< 0.90", risk: "Low Risk", color: "bg-green-500" },
    { range: "0.90 - 0.95", risk: "Moderate Risk", color: "bg-yellow-500" },
    { range: "0.96 - 1.00", risk: "High Risk", color: "bg-orange-500" },
    { range: "> 1.00", risk: "Very High Risk", color: "bg-red-500" },
  ]

  const femaleCategories: WHRCategory[] = [
    { range: "< 0.80", risk: "Low Risk", color: "bg-green-500" },
    { range: "0.80 - 0.85", risk: "Moderate Risk", color: "bg-yellow-500" },
    { range: "0.86 - 0.90", risk: "High Risk", color: "bg-orange-500" },
    { range: "> 0.90", risk: "Very High Risk", color: "bg-red-500" },
  ]

  // Calculate WHR whenever inputs change
  useEffect(() => {
    calculateWHR()
  }, [waist, hip, gender])

  // Calculate WHR and determine risk category
  const calculateWHR = () => {
    if (hip === 0) return
    
    const whrValue = waist / hip
    setWHR(parseFloat(whrValue.toFixed(2)))
    
    const categories = gender === "male" ? maleCategories : femaleCategories
    
    // Set risk category based on calculated value
    if (gender === "male") {
      if (whrValue < 0.90) {
        setRiskCategory(categories[0])
      } else if (whrValue <= 0.95) {
        setRiskCategory(categories[1])
      } else if (whrValue <= 1.00) {
        setRiskCategory(categories[2])
      } else {
        setRiskCategory(categories[3])
      }
    } else {
      if (whrValue < 0.80) {
        setRiskCategory(categories[0])
      } else if (whrValue <= 0.85) {
        setRiskCategory(categories[1])
      } else if (whrValue <= 0.90) {
        setRiskCategory(categories[2])
      } else {
        setRiskCategory(categories[3])
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Gender selection */}
      <div className="space-y-2">
        <Label>Gender</Label>
        <RadioGroup
          defaultValue="male"
          value={gender}
          onValueChange={setGender}
          className="flex space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="male" id="whr-male" />
            <Label htmlFor="whr-male">Male</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="female" id="whr-female" />
            <Label htmlFor="whr-female">Female</Label>
          </div>
        </RadioGroup>
      </div>

      {/* Body visualization */}
      <div className="flex justify-center py-2">
        <div className=" flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-muted mb-2"></div>
          <div 
            className="w-20 h-16 rounded-lg bg-muted mb-2 relative"
            style={{ width: `${Math.max(40, Math.min(140, waist / 2))}px` }}
          >
            <div className="absolute -left-20 top-1/2 transform -translate-y-1/3 text-xs text-muted-foreground">
              Waist: {waist} cm
            </div>
          </div>
          <div 
            className="w-24 h-20 rounded-lg bg-muted relative"
            style={{ width: `${Math.max(40, Math.min(140, hip / 2))}px` }}
          >
            <div className="absolute -left-20 top-1/2 transform -translate-y-2/3 text-xs text-muted-foreground">
              Hip: {hip} cm
            </div>
          </div>
        </div>
      </div>

      {/* Waist circumference slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="waist">Waist Circumference</Label>
          <span className="text-sm font-medium">{waist} cm</span>
        </div>
        <Slider 
          id="waist"
          min={50}
          max={150}
          step={1}
          value={[waist]}
          onValueChange={(value) => setWaist(value[0])}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>50 cm</span>
          <span>150 cm</span>
        </div>
      </div>

      {/* Hip circumference slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="hip">Hip Circumference</Label>
          <span className="text-sm font-medium">{hip} cm</span>
        </div>
        <Slider 
          id="hip"
          min={70}
          max={170}
          step={1}
          value={[hip]}
          onValueChange={(value) => setHip(value[0])}
          className="py-4"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>70 cm</span>
          <span>170 cm</span>
        </div>
      </div>

      {/* Result section */}
      <div className="pt-4">
        <div className="text-center">
          <div className="text-sm text-muted-foreground mb-1">Your Waist-to-Hip Ratio</div>
          <div className="text-4xl font-bold">{whr}</div>
          <Badge 
            className={`mt-2 ${riskCategory.color} hover:${riskCategory.color}`}
          >
            {riskCategory.risk}
          </Badge>
        </div>

        {/* WHR categories */}
        <div className="mt-6">
          <Label className="mb-3 block font-medium">Health Risk Categories</Label>
          <div className="space-y-2">
            {(gender === "male" ? maleCategories : femaleCategories).map((category, index) => (
              <div 
                key={index} 
                className={`p-2 rounded-md text-sm flex justify-between ${
                  category.risk === riskCategory.risk ? 'bg-muted border border-primary' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                  <span>{category.range}</span>
                </div>
                <span>{category.risk}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Information alert */}
        <Alert className="mt-6 bg-muted/50">
          <InfoIcon className="h-4 w-4" />
          <AlertDescription className="text-xs text-muted-foreground">
            WHR = waist circumference / hip circumference. Measure your waist at the narrowest point 
            and your hips at the widest point. Higher ratios indicate more abdominal fat and 
            potentially higher health risks.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}

export default WHRCalculator