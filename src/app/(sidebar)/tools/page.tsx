'use client'

import React from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import BMICalculator from './_components/BMICalculator'
import BMRCalculator from './_components/BMRCalculator'
import WHRCalculator from './_components/WHRCalculator'

const FitnessToolsPage: React.FC = () => {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-2 text-center">Fitness Calculators</h1>
      <p className="text-muted-foreground text-center mb-8">
        Track your health metrics with these easy-to-use calculators
      </p>
      
      <Tabs defaultValue="bmi" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="bmi">BMI</TabsTrigger>
          <TabsTrigger value="bmr">BMR</TabsTrigger>
          <TabsTrigger value="whr">WHR</TabsTrigger>
        </TabsList>
        
        <TabsContent value="bmi">
          <Card>
            <CardHeader>
              <CardTitle>Body Mass Index (BMI)</CardTitle>
              <CardDescription>
                Measures body fat based on height and weight
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BMICalculator />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="bmr">
          <Card>
            <CardHeader>
              <CardTitle>Basal Metabolic Rate (BMR)</CardTitle>
              <CardDescription>
                Calculates your daily calorie needs at rest
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BMRCalculator />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="whr">
          <Card>
            <CardHeader>
              <CardTitle>Waist-to-Hip Ratio (WHR)</CardTitle>
              <CardDescription>
                Measures fat distribution to assess health risk
              </CardDescription>
            </CardHeader>
            <CardContent>
              <WHRCalculator />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default FitnessToolsPage