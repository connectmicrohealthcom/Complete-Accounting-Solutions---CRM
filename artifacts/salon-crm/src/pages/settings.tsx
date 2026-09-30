import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Configure your salon preferences and business details.</p>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>Your salon's public details and receipt information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salonName">Salon Name</Label>
                <Input id="salonName" defaultValue="Layal Al Zahra" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" defaultValue="+971 50 123 4567" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" defaultValue="Jumeirah Beach Road, Dubai, UAE" />
              </div>
            </div>
            <Button className="mt-4">Save Changes</Button>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle>Booking Preferences</CardTitle>
            <CardDescription>Manage how clients can book appointments.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="space-y-0.5">
                <Label className="text-base">Online Booking</Label>
                <p className="text-sm text-muted-foreground">Allow clients to book appointments through the public portal.</p>
              </div>
              <div className="h-6 w-11 rounded-full bg-primary relative cursor-pointer">
                <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white shadow-sm"></div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 border rounded-lg bg-card">
              <div className="space-y-0.5">
                <Label className="text-base">Automated Reminders</Label>
                <p className="text-sm text-muted-foreground">Send SMS reminders 24 hours before appointments.</p>
              </div>
              <div className="h-6 w-11 rounded-full bg-primary relative cursor-pointer">
                <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-white shadow-sm"></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>Destructive actions for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full sm:w-auto">Clear All Cache</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
