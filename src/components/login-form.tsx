'use client'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import React from "react"
import { toast } from "sonner"
import { LoginMember } from "@/action/auth.action"
import { cookies } from "next/headers"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [credenials, setCredentials] = React.useState({
    phone: "",
    password: "",
  })

  const handleLogin = async (e: any) => {
    e.preventDefault()
    if (credenials.phone == '' || credenials.password == '') {
      toast.error('Please fill all the required fields')
      return
    }
    const res = await LoginMember(credenials)
    toast.error("Incorrect phone or password")
    return
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Login</CardTitle>
          <CardDescription>
            Enter your registered phone number below to login to your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form>
            <div className="flex flex-col gap-6">
              <div className="grid gap-3">
                <Label htmlFor="email">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter a valid phone number"
                  required
                  onChange={(e) => setCredentials({ ...credenials, phone: e.target.value })}
                />
              </div>
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>

                </div>
                <Input id="password" type="password" required placeholder="Enter your password" onChange={(e) => setCredentials({ ...credenials, password: e.target.value })} />
              </div>
              <div className="flex flex-col gap-3">
                <Button type="submit" onClick={handleLogin} className="w-full">
                  Login
                </Button>
              </div>
            </div>
            <div className="mt-4 text-center text-sm">
              Don&apos;t have an account? Ask at your gym's front desk
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
